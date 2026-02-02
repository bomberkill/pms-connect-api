#!/usr/bin/env ts-node

/**
 * Migration Script: Transfer group members data to GroupMembership collection
 * 
 * This script migrates data from the embedded members array (groups.members)
 * to the new GroupMembership collection for better scalability.
 * 
 * Usage:
 *   npm run migrate:group-members [--dry-run] [--batch-size=50]
 * 
 * Options:
 *   --dry-run: Preview changes without applying them
 *   --batch-size: Number of groups to process per batch (default: 50)
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Group, GroupDocument } from '../../src/groups/schemas/group.schema';
import { GroupMembership, GroupMembershipDocument } from '../../src/groups/schemas/group-membership.schema';

interface MigrationStats {
    groupsProcessed: number;
    membershipsCreated: number;
    duplicatesSkipped: number;
    errors: number;
    startTime: Date;
    endTime?: Date;
}

async function migrate() {
    console.log('🚀 Starting GroupMembership migration...\n');

    // Parse command line arguments
    const args = process.argv.slice(2);
    const isDryRun = args.includes('--dry-run');
    const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
    const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 50;

    if (isDryRun) {
        console.log('⚠️  DRY RUN MODE - No changes will be made\n');
    }

    // Initialize NestJS application
    const app = await NestFactory.createApplicationContext(AppModule);
    const groupModel = app.get<Model<GroupDocument>>(getModelToken(Group.name));
    const membershipModel = app.get<Model<GroupMembershipDocument>>(getModelToken(GroupMembership.name));

    const stats: MigrationStats = {
        groupsProcessed: 0,
        membershipsCreated: 0,
        duplicatesSkipped: 0,
        errors: 0,
        startTime: new Date(),
    };

    try {
        // Get total count
        const totalGroups = await groupModel.countDocuments({});
        console.log(`📊 Total groups to process: ${totalGroups}\n`);

        // Process in batches
        let skip = 0;
        while (skip < totalGroups) {
            const groups = await groupModel
                .find({})
                .select('_id members')
                .skip(skip)
                .limit(batchSize)
                .lean();

            console.log(`Processing batch: ${skip + 1} - ${skip + groups.length}`);

            for (const group of groups) {
                try {
                    stats.groupsProcessed++;

                    // Process members
                    if (group.members && Array.isArray(group.members)) {
                        for (const member of group.members) {
                            try {
                                if (!isDryRun) {
                                    // Check if already exists
                                    const exists = await membershipModel.exists({
                                        group: group._id,
                                        user: member.user,
                                    });

                                    if (exists) {
                                        stats.duplicatesSkipped++;
                                        continue;
                                    }

                                    // Create membership document
                                    await membershipModel.create({
                                        group: group._id,
                                        user: member.user,
                                        role: member.role,
                                        // joinedAt will be set automatically by schema
                                    });
                                }

                                stats.membershipsCreated++;
                            } catch (error) {
                                // Duplicate key error is expected if membership already exists
                                if (error.code === 11000) {
                                    stats.duplicatesSkipped++;
                                } else {
                                    console.error(`Error creating membership: group ${group._id}, user ${member.user}`, error.message);
                                    stats.errors++;
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error processing group ${group._id}:`, error.message);
                    stats.errors++;
                }
            }

            skip += batchSize;

            // Progress update
            const progress = ((skip / totalGroups) * 100).toFixed(2);
            console.log(`Progress: ${progress}% (${stats.membershipsCreated} memberships created, ${stats.duplicatesSkipped} duplicates skipped)\n`);
        }

        stats.endTime = new Date();

        // Print summary
        console.log('\n✅ Migration completed!\n');
        console.log('📊 Summary:');
        console.log(`   Groups processed: ${stats.groupsProcessed}`);
        console.log(`   Memberships created: ${stats.membershipsCreated}`);
        console.log(`   Duplicates skipped: ${stats.duplicatesSkipped}`);
        console.log(`   Errors: ${stats.errors}`);
        console.log(`   Duration: ${((stats.endTime.getTime() - stats.startTime.getTime()) / 1000).toFixed(2)}s`);

        if (isDryRun) {
            console.log('\n⚠️  This was a DRY RUN - no changes were made');
        }

        // Verification
        if (!isDryRun && stats.errors === 0) {
            console.log('\n🔍 Verifying migration...');
            const membershipCount = await membershipModel.countDocuments({});
            console.log(`   Total GroupMembership documents: ${membershipCount}`);

            // Sample verification
            const sampleGroup = await groupModel.findOne({ members: { $exists: true, $ne: [] } });
            if (sampleGroup) {
                const membersCount = sampleGroup.members.length;
                const migratedCount = await membershipModel.countDocuments({ group: sampleGroup._id });
                console.log(`   Sample group ${sampleGroup._id}:`);
                console.log(`     Original members count: ${membersCount}`);
                console.log(`     Migrated membership count: ${migratedCount}`);
                console.log(`     Match: ${membersCount === migratedCount ? '✅' : '❌'}`);
            }
        }

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        stats.errors++;
    } finally {
        await app.close();
    }

    process.exit(stats.errors > 0 ? 1 : 0);
}

migrate();

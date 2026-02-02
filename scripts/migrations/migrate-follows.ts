#!/usr/bin/env ts-node

/**
 * Migration Script: Transfer following/followers data to Follow collection
 * 
 * This script migrates data from the embedded arrays (users.following, users.followers)
 * to the new Follow collection for better scalability.
 * 
 * Usage:
 *   npm run migrate:follows [--dry-run] [--batch-size=100]
 * 
 * Options:
 *   --dry-run: Preview changes without applying them
 *   --batch-size: Number of users to process per batch (default: 100)
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../src/users/schemas/users.schema';
import { Follow, FollowDocument } from '../../src/follows/schemas/follow.schema';

interface MigrationStats {
    usersProcessed: number;
    followsCreated: number;
    duplicatesSkipped: number;
    errors: number;
    startTime: Date;
    endTime?: Date;
}

async function migrate() {
    console.log('🚀 Starting Follow migration...\n');

    // Parse command line arguments
    const args = process.argv.slice(2);
    const isDryRun = args.includes('--dry-run');
    const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
    const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 100;

    if (isDryRun) {
        console.log('⚠️  DRY RUN MODE - No changes will be made\n');
    }

    // Initialize NestJS application
    const app = await NestFactory.createApplicationContext(AppModule);
    const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
    const followModel = app.get<Model<FollowDocument>>(getModelToken(Follow.name));

    const stats: MigrationStats = {
        usersProcessed: 0,
        followsCreated: 0,
        duplicatesSkipped: 0,
        errors: 0,
        startTime: new Date(),
    };

    try {
        // Get total count
        const totalUsers = await userModel.countDocuments({});
        console.log(`📊 Total users to process: ${totalUsers}\n`);

        // Process in batches
        let skip = 0;
        while (skip < totalUsers) {
            const users = await userModel
                .find({})
                .select('_id following followers')
                .skip(skip)
                .limit(batchSize)
                .lean();

            console.log(`Processing batch: ${skip + 1} - ${skip + users.length}`);

            for (const user of users) {
                try {
                    stats.usersProcessed++;

                    // Process following relationships
                    if (user.following && Array.isArray(user.following)) {
                        for (const followingId of user.following) {
                            try {
                                if (!isDryRun) {
                                    // Check if already exists
                                    const exists = await followModel.exists({
                                        follower: user._id,
                                        following: followingId,
                                    });

                                    if (exists) {
                                        stats.duplicatesSkipped++;
                                        continue;
                                    }

                                    // Create follow document
                                    await followModel.create({
                                        follower: user._id,
                                        following: followingId,
                                    });
                                }

                                stats.followsCreated++;
                            } catch (error) {
                                // Duplicate key error is expected if relationship already exists
                                if (error.code === 11000) {
                                    stats.duplicatesSkipped++;
                                } else {
                                    console.error(`Error creating follow: ${user._id} -> ${followingId}`, error.message);
                                    stats.errors++;
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error processing user ${user._id}:`, error.message);
                    stats.errors++;
                }
            }

            skip += batchSize;

            // Progress update
            const progress = ((skip / totalUsers) * 100).toFixed(2);
            console.log(`Progress: ${progress}% (${stats.followsCreated} follows created, ${stats.duplicatesSkipped} duplicates skipped)\n`);
        }

        stats.endTime = new Date();

        // Print summary
        console.log('\n✅ Migration completed!\n');
        console.log('📊 Summary:');
        console.log(`   Users processed: ${stats.usersProcessed}`);
        console.log(`   Follows created: ${stats.followsCreated}`);
        console.log(`   Duplicates skipped: ${stats.duplicatesSkipped}`);
        console.log(`   Errors: ${stats.errors}`);
        console.log(`   Duration: ${((stats.endTime.getTime() - stats.startTime.getTime()) / 1000).toFixed(2)}s`);

        if (isDryRun) {
            console.log('\n⚠️  This was a DRY RUN - no changes were made');
        }

        // Verification
        if (!isDryRun && stats.errors === 0) {
            console.log('\n🔍 Verifying migration...');
            const followCount = await followModel.countDocuments({});
            console.log(`   Total Follow documents: ${followCount}`);

            // Sample verification
            const sampleUser = await userModel.findOne({ following: { $exists: true, $ne: [] } });
            if (sampleUser) {
                const followingCount = sampleUser.following.length;
                const migratedCount = await followModel.countDocuments({ follower: sampleUser._id });
                console.log(`   Sample user ${sampleUser._id}:`);
                console.log(`     Original following count: ${followingCount}`);
                console.log(`     Migrated follow count: ${migratedCount}`);
                console.log(`     Match: ${followingCount === migratedCount ? '✅' : '❌'}`);
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

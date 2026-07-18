import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectionRequestStatus } from '../../generated/prisma/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { UsersService } from './users.service';
import { PUB_SUB } from '../pubsub/pubsub.module';
import { GetConnectionRequestsArgs } from './dto/get-connection-requests.args';

const WITH_PARTIES = { requester: true, recipient: true };

@Injectable()
export class ConnectionRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Envoie une demande de connexion d'un utilisateur à un autre.
   */
  async sendConnectionRequest(requesterId: string, recipientId: string) {
    if (requesterId === recipientId) {
      throw new BadRequestException(
        'You cannot send a connection request to yourself.',
      );
    }

    const recipient = await this.prisma.user.findUnique({
      where: { id: recipientId },
      select: { id: true },
    });
    if (!recipient) {
      throw new NotFoundException(`User with ID "${recipientId}" not found.`);
    }

    const alreadyConnected = await this.prisma.connectionRequest.findFirst({
      where: {
        status: ConnectionRequestStatus.ACCEPTED,
        OR: [
          { requesterId, recipientId },
          { requesterId: recipientId, recipientId: requesterId },
        ],
      },
    });
    if (alreadyConnected) {
      throw new ConflictException('You are already connected with this user.');
    }

    const existingRequest = await this.prisma.connectionRequest.findFirst({
      where: {
        status: {
          in: [ConnectionRequestStatus.PENDING, ConnectionRequestStatus.ACCEPTED],
        },
        OR: [
          { requesterId, recipientId },
          { requesterId: recipientId, recipientId: requesterId },
        ],
      },
    });
    if (existingRequest) {
      throw new ConflictException(
        'A connection request already exists between you and this user.',
      );
    }

    // Note: the pubsub payload below must match
    // ConnectionRequestForSubscriptionGQL, which declares requester/recipient
    // as plain id strings — not the populated User objects ConnectionRequestGQL
    // (the regular query type) expects. Don't `include` here.
    const savedRequest = await this.prisma.connectionRequest.create({
      data: { requesterId, recipientId, status: ConnectionRequestStatus.PENDING },
    });

    this.pubSub.publish('CONNECTION_REQUEST_UPDATED', {
      connectionRequestUpdated: savedRequest,
    });

    this.notificationsService.create({
      recipients: [recipientId],
      sender: requesterId,
      type: NotificationType.CONNECTION_REQUEST,
    });

    return savedRequest;
  }

  /**
   * Accepte une demande de connexion.
   */
  async acceptConnectionRequest(
    requestId: string,
    currentUserId: string,
  ): Promise<void> {
    const request = await this.prisma.connectionRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.recipientId !== currentUserId) {
      throw new NotFoundException(
        'Connection request not found or you are not the recipient.',
      );
    }

    if (request.status !== ConnectionRequestStatus.PENDING) {
      throw new ConflictException(
        `This request is already ${request.status.toLowerCase()}.`,
      );
    }

    const { requesterId, recipientId } = request;

    const updatedRequest = await this.prisma.connectionRequest.update({
      where: { id: requestId },
      data: { status: ConnectionRequestStatus.ACCEPTED },
    });

    await Promise.all([
      this.usersService.follow(requesterId, recipientId),
      this.usersService.follow(recipientId, requesterId),
    ]);

    this.pubSub.publish('CONNECTION_REQUEST_UPDATED', {
      connectionRequestUpdated: updatedRequest,
    });

    this.notificationsService.create({
      recipients: [requesterId],
      sender: recipientId,
      type: NotificationType.CONNECTION_ACCEPTED,
      entityId: recipientId,
      onModel: 'User',
    });
  }

  /**
   * Refuse ou annule une demande de connexion.
   */
  async declineOrCancelConnectionRequest(
    requestId: string,
    currentUserId: string,
  ): Promise<void> {
    const request = await this.prisma.connectionRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Connection request not found.');
    }

    const isRequester = request.requesterId === currentUserId;
    const isRecipient = request.recipientId === currentUserId;

    if (!isRequester && !isRecipient) {
      throw new BadRequestException(
        'You are not authorized to modify this request.',
      );
    }

    const updatedRequest = await this.prisma.connectionRequest.update({
      where: { id: requestId },
      data: {
        status: isRequester
          ? ConnectionRequestStatus.CANCELLED
          : ConnectionRequestStatus.DECLINED,
      },
    });

    this.pubSub.publish('CONNECTION_REQUEST_UPDATED', {
      connectionRequestUpdated: updatedRequest,
    });
  }

  /**
   * Finds connection requests for a specific user.
   */
  async findConnectionRequestsForUser(
    userId: string,
    status?: ConnectionRequestStatus,
  ) {
    return this.prisma.connectionRequest.findMany({
      where: {
        OR: [{ requesterId: userId }, { recipientId: userId }],
        ...(status && { status }),
      },
      include: WITH_PARTIES,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Gets all connections for a specific user. "Connected" is derived from
   * an ACCEPTED ConnectionRequest, not a separately-maintained list.
   */
  async getConnections(userId: string, skip = 0, limit = 10) {
    const requests = await this.prisma.connectionRequest.findMany({
      where: {
        status: ConnectionRequestStatus.ACCEPTED,
        OR: [{ requesterId: userId }, { recipientId: userId }],
      },
      include: WITH_PARTIES,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    return requests.map((r) =>
      r.requesterId === userId ? r.recipient : r.requester,
    );
  }

  async adminFindAll(args: GetConnectionRequestsArgs) {
    const { skip, limit, requesterId, recipientId, status } = args;
    return this.prisma.connectionRequest.findMany({
      where: {
        ...(requesterId && { requesterId }),
        ...(recipientId && { recipientId }),
        ...(status && { status }),
      },
      include: WITH_PARTIES,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
  }
}

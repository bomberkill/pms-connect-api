import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { PubSub } from 'graphql-subscriptions';
import { User, UserDocument } from './schemas/users.schema';
import {
  ConnectionRequest,
  ConnectionRequestDocument,
  ConnectionRequestStatus,
} from './schemas/connection-request.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { UsersService } from './users.service';
import { PUB_SUB } from '../pubsub/pubsub.module';
import { GetConnectionRequestsArgs } from './dto/get-connection-requests.args';

@Injectable()
export class ConnectionRequestsService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(ConnectionRequest.name)
    private readonly connectionRequestModel: Model<ConnectionRequestDocument>,
    private readonly notificationsService: NotificationsService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
    private readonly usersService: UsersService, // We need it for the follow logic
  ) {}

  /**
   * Envoie une demande de connexion d'un utilisateur à un autre.
   */
  async sendConnectionRequest(
    requesterId: string,
    recipientId: string,
  ): Promise<ConnectionRequest> {
    if (requesterId === recipientId) {
      throw new BadRequestException(
        'You cannot send a connection request to yourself.',
      );
    }

    const [requester, recipient] = await Promise.all([
      this.userModel.findById(requesterId).select('connections').lean(),
      this.userModel.findById(recipientId).select('_id').lean(),
    ]);

    if (!recipient) {
      throw new NotFoundException(`User with ID "${recipientId}" not found.`);
    }

    if (
      requester.connections.map((id) => id.toString()).includes(recipientId)
    ) {
      throw new ConflictException('You are already connected with this user.');
    }

    const existingRequest = await this.connectionRequestModel.findOne({
      $and: [
        {
          $or: [
            { requester: requesterId, recipient: recipientId },
            { requester: recipientId, recipient: requesterId },
          ],
        },
        {
          status: {
            $in: [
              ConnectionRequestStatus.PENDING,
              ConnectionRequestStatus.ACCEPTED,
            ],
          },
        },
      ],
    });

    if (existingRequest) {
      throw new ConflictException(
        'A connection request already exists between you and this user.',
      );
    }

    const newRequest = new this.connectionRequestModel({
      requester: requesterId,
      recipient: recipientId,
      status: 'PENDING',
    });

    const savedRequest = await newRequest.save();

    // Publish event for the recipient
    // const populatedRequest = await savedRequest.populate(['requester', 'recipient']);
    // console.log('Publishing CONNECTION_REQUEST_UPDATED event ', populatedRequest);
    this.pubSub.publish('CONNECTION_REQUEST_UPDATED', {
      connectionRequestUpdated: savedRequest,
    });
    console.log('Event CONNECTION_REQUEST_UPDATED published');

    // Create notification for the recipient
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
    const request = await this.connectionRequestModel.findById(requestId);

    if (!request || request.recipient.toString() !== currentUserId) {
      throw new NotFoundException(
        'Connection request not found or you are not the recipient.',
      );
    }

    if (request.status !== 'PENDING') {
      throw new ConflictException(
        `This request is already ${request.status.toLowerCase()}.`,
      );
    }

    const { requester, recipient } = request;

    const updateUserA = this.userModel.updateOne(
      { _id: requester },
      { $addToSet: { connections: recipient } },
    );
    const updateUserB = this.userModel.updateOne(
      { _id: recipient },
      { $addToSet: { connections: requester } },
    );

    request.status = ConnectionRequestStatus.ACCEPTED;
    const updateRequest = request.save();

    const followAtoB = this.usersService.follow(
      requester.toString(),
      recipient.toString(),
    );
    const followBtoA = this.usersService.follow(
      recipient.toString(),
      requester.toString(),
    );

    // Attendre que toutes les opérations de base soient terminées
    const [, , savedRequest] = await Promise.all([
      updateUserA,
      updateUserB,
      updateRequest,
      followAtoB,
      followBtoA,
    ]);

    // 1. Publier la mise à jour de la demande de connexion AVEC les données peuplées
    // const populatedRequest = await savedRequest.populate(['requester', 'recipient']);
    this.pubSub.publish('CONNECTION_REQUEST_UPDATED', {
      connectionRequestUpdated: savedRequest,
    });

    this.notificationsService.create({
      recipients: [requester.toString()],
      sender: recipient.toString(),
      type: NotificationType.CONNECTION_ACCEPTED,
      entityId: recipient.toString(),
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
    const request = await this.connectionRequestModel.findById(requestId);

    if (!request) {
      throw new NotFoundException('Connection request not found.');
    }

    const isRequester = request.requester.toString() === currentUserId;
    const isRecipient = request.recipient.toString() === currentUserId;

    if (!isRequester && !isRecipient) {
      throw new BadRequestException(
        'You are not authorized to modify this request.',
      );
    }

    if (isRequester) {
      request.status = ConnectionRequestStatus.CANCELLED;
    } else if (isRecipient) {
      request.status = ConnectionRequestStatus.DECLINED;
    }

    const savedRequest = await request.save();

    // Publish event for both users
    // const populatedRequest = await savedRequest.populate(['requester', 'recipient']);
    this.pubSub.publish('CONNECTION_REQUEST_UPDATED', {
      connectionRequestUpdated: savedRequest,
    });
  }

  /**
   * Finds connection requests for a specific user.
   */
  async findConnectionRequestsForUser(
    userId: string,
    status?: ConnectionRequestStatus,
  ): Promise<ConnectionRequestDocument[]> {
    const query: FilterQuery<ConnectionRequestDocument> = {
      $or: [{ requester: userId }, { recipient: userId }],
    };

    if (status) {
      query.status = status;
    }

    return this.connectionRequestModel
      .find(query)
      .populate('requester recipient')
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Gets all connections for a specific user.
   * Returns all users that are in the user's connections array.
   */
  async getConnections(userId: string): Promise<UserDocument[]> {
    const user = await this.userModel
      .findById(userId)
      .select('connections')
      .lean();

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found.`);
    }

    // Fetch all connected users
    return this.userModel.find({ _id: { $in: user.connections } }).exec();
  }

  async adminFindAll(
    args: GetConnectionRequestsArgs,
  ): Promise<ConnectionRequestDocument[]> {
    const { skip, limit, requesterId, recipientId, status } = args;
    const query: FilterQuery<ConnectionRequestDocument> = {};

    if (requesterId) {
      query.requester = requesterId;
    }

    if (recipientId) {
      query.recipient = recipientId;
    }

    if (status) {
      query.status = status;
    }

    return this.connectionRequestModel
      .find(query)
      .populate('requester recipient')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }
}

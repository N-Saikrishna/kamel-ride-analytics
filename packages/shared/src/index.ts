// Public exports for @kamel/shared — event schemas, types, and parseEvent.

export {
  BaseEventSchema,
  AnyEventSchema,
  UserSignedUpEventSchema,
  RideSearchedEventSchema,
  RideRequestedEventSchema,
  RideMatchedEventSchema,
  RideAcceptedEventSchema,
  RideCancelledEventSchema,
  RideCompletedEventSchema,
  DriverRatedEventSchema,
  PostCreatedEventSchema,
  MessageSentEventSchema,
  parseEvent,
} from "./events.js";

export type {
  BaseEvent,
  AnyEvent,
  UserSignedUpEvent,
  RideSearchedEvent,
  RideRequestedEvent,
  RideMatchedEvent,
  RideAcceptedEvent,
  RideCancelledEvent,
  RideCompletedEvent,
  DriverRatedEvent,
  PostCreatedEvent,
  MessageSentEvent,
  ParseEventResult,
  ParseEventSuccess,
  ParseEventFailure,
} from "./events.js";

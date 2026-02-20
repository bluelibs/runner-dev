import {
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
  type GraphQLFieldConfigMap,
} from "graphql";

const TaskInterceptorOwnersEntryType = new GraphQLObjectType({
  name: "TaskInterceptorOwnersEntry",
  fields: (): GraphQLFieldConfigMap<any, any> => ({
    taskId: { type: new GraphQLNonNull(GraphQLString) },
    ownerResourceIds: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
  }),
});

const MiddlewareInterceptorOwnersEntryType = new GraphQLObjectType({
  name: "MiddlewareInterceptorOwnersEntry",
  fields: (): GraphQLFieldConfigMap<any, any> => ({
    middlewareId: { type: new GraphQLNonNull(GraphQLString) },
    ownerResourceIds: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
  }),
});

const MiddlewareInterceptorOwnersSnapshotType = new GraphQLObjectType({
  name: "MiddlewareInterceptorOwnersSnapshot",
  fields: (): GraphQLFieldConfigMap<any, any> => ({
    globalTaskInterceptorOwnerIds: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    globalResourceInterceptorOwnerIds: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    perTaskMiddlewareInterceptorOwnerIds: {
      type: new GraphQLNonNull(
        new GraphQLList(
          new GraphQLNonNull(MiddlewareInterceptorOwnersEntryType)
        )
      ),
      resolve: (node: any) =>
        Object.entries(node?.perTaskMiddlewareInterceptorOwnerIds ?? {}).map(
          ([middlewareId, ownerResourceIds]) => ({
            middlewareId,
            ownerResourceIds,
          })
        ),
    },
    perResourceMiddlewareInterceptorOwnerIds: {
      type: new GraphQLNonNull(
        new GraphQLList(
          new GraphQLNonNull(MiddlewareInterceptorOwnersEntryType)
        )
      ),
      resolve: (node: any) =>
        Object.entries(
          node?.perResourceMiddlewareInterceptorOwnerIds ?? {}
        ).map(([middlewareId, ownerResourceIds]) => ({
          middlewareId,
          ownerResourceIds,
        })),
    },
  }),
});

export const InterceptorOwnersSnapshotType = new GraphQLObjectType({
  name: "InterceptorOwnersSnapshot",
  fields: (): GraphQLFieldConfigMap<any, any> => ({
    tasksById: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(TaskInterceptorOwnersEntryType))
      ),
      resolve: (node: any) =>
        Object.entries(node?.tasksById ?? {}).map(
          ([taskId, ownerResourceIds]) => ({
            taskId,
            ownerResourceIds,
          })
        ),
    },
    middleware: {
      type: new GraphQLNonNull(MiddlewareInterceptorOwnersSnapshotType),
    },
  }),
});

const { withFilter } = require('graphql-subscriptions')
const path = require('path')
const globby = require('globby')
const merge = require('lodash.merge')
const GraphQLJSON = require('graphql-type-json')
// Channels for subscriptions
const channels = require('./channels')
// Connectors
const cwd = require('./connectors/cwd')
const progress = require('./connectors/progress')
const files = require('./connectors/files')
const clientAddons = require('./connectors/client-addons')
const sharedData = require('./connectors/shared-data')
const locales = require('./connectors/locales')
// Start ipc server
require('./utils/ipc')

process.env.VUE_CLI_API_MODE = true

const resolvers = [{
  JSON: GraphQLJSON,

  DescribedEntity: {
    __resolveType (obj, context, info) {
      return null
    }
  },

  ClientAddon: {
    url: (addon, args, context) => clientAddons.getUrl(addon, context)
  },

  Query: {
    cwd: () => cwd.get(),
    progress: (root, { id }, context) => progress.get(id, context),
    clientAddons: (root, args, context) => clientAddons.list(context),
    sharedData: (root, { id }, context) => sharedData.get(id, context),
    locales: (root, args, context) => locales.list(context)
  },

  Mutation: {
    fileOpenInEditor: (root, { input }, context) => files.openInEditor(input, context),
    sharedDataUpdate: (root, args, context) => sharedData.set(args, context)
  },

  Subscription: {
    cwdChanged: {
      subscribe: (parent, args, { pubsub }) => pubsub.asyncIterator(channels.CWD_CHANGED)
    },
    progressChanged: {
      subscribe: withFilter(
        // Iterator
        (parent, args, { pubsub }) => pubsub.asyncIterator(channels.PROGRESS_CHANGED),
        // Filter
        (payload, vars) => payload.progressChanged.id === vars.id
      )
    },
    progressRemoved: {
      subscribe: withFilter(
        // Iterator
        (parent, args, { pubsub }) => pubsub.asyncIterator(channels.PROGRESS_REMOVED),
        // Filter
        (payload, vars) => payload.progressRemoved.id === vars.id
      )
    },
    clientAddonAdded: {
      subscribe: (parent, args, { pubsub }) => pubsub.asyncIterator(channels.CLIENT_ADDON_ADDED)
    },
    sharedDataUpdated: {
      subscribe: withFilter(
        (parent, args, { pubsub }) => pubsub.asyncIterator(channels.SHARED_DATA_UPDATED),
        (payload, vars) => payload.sharedDataUpdated.id === vars.id
      )
    },
    localeAdded: {
      subscribe: (parent, args, { pubsub }) => pubsub.asyncIterator(channels.LOCALE_ADDED)
    }
  }
}]

// Load resolvers in './schema'
const paths = globby.sync([path.join(__dirname, './schema/*.js')])
paths.forEach(file => {
  const { resolvers: r } = require(file)
  r && resolvers.push(r)
})

module.exports = merge.apply(null, resolvers)

import { mutation, v } from "./_generated/server"

export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl()
})

export const getFileUrl = mutation({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId)
  },
})

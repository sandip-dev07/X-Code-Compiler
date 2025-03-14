import { Redis } from "@upstash/redis"

// Create a Redis client using Upstash
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
})

export default redis


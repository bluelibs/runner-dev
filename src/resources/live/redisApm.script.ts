/** All keys share a hash tag; write, age/count/byte eviction and restore are atomic. */
export const REDIS_APM_SCRIPT = `
local entries,data,times,meta=KEYS[1],KEYS[2],KEYS[3],KEYS[4]
local cutoff,maxCount,maxBytes=tonumber(ARGV[2]),tonumber(ARGV[3]),tonumber(ARGV[4])
local function remove(id)
 local value=redis.call('HGET',data,id)
 if value then redis.call('HINCRBY',meta,'bytes',-string.len(value)) end
 redis.call('HDEL',data,id);redis.call('ZREM',entries,id);redis.call('ZREM',times,id)
end
local highest=tonumber(redis.call('HGET',meta,'lastSequence') or '0')
local batch=cjson.decode(ARGV[1])
-- Validate the whole batch before writing: Redis does not roll back script errors.
local previous=highest
for _,item in ipairs(batch) do
 local sequence=tonumber(item.sequence)
 if not sequence or sequence<=previous then return redis.error_reply('APM sequences must increase; use one stream per runtime') end
 if maxBytes>0 and string.len(item.record)>maxBytes then return redis.error_reply('APM sample exceeds maxStorage') end
 previous=sequence
end
for _,item in ipairs(batch) do
 redis.call('ZADD',entries,item.sequence,item.sequence)
 redis.call('ZADD',times,item.timestampMs,item.sequence)
 redis.call('HSET',data,item.sequence,item.record)
 redis.call('HINCRBY',meta,'bytes',string.len(item.record))
 redis.call('HSET',meta,'lastSequence',item.sequence)
end
if cutoff then
 for _,id in ipairs(redis.call('ZRANGEBYSCORE',times,'-inf','('..ARGV[2])) do remove(id) end
end
while redis.call('ZCARD',entries)>maxCount or (maxBytes>0 and tonumber(redis.call('HGET',meta,'bytes') or '0')>maxBytes) do
 local oldest=redis.call('ZRANGE',entries,0,0)[1]
 if not oldest then break end
 remove(oldest)
end
-- Expire idle sample data too; retain sequence metadata across stream restarts.
local ttl=tonumber(ARGV[6])
for _,key in ipairs({entries,data,times}) do
 if ttl>0 then redis.call('PEXPIRE',key,ttl) else redis.call('PERSIST',key) end
end
local records={}
if tonumber(ARGV[5])>0 then
 for _,id in ipairs(redis.call('ZREVRANGE',entries,0,tonumber(ARGV[5])-1)) do table.insert(records,redis.call('HGET',data,id)) end
end
return {redis.call('HGET',meta,'lastSequence') or '0',records}
`;

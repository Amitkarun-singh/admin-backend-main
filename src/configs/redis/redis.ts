import { createClient } from 'redis';

const client = createClient({
  url: 'redis://localhost:32768'
});

client.on('error', err => console.log('Redis Client Error', err));

await client.connect();

console.log('Redis connected');

export default client;
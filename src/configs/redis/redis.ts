import { createClient } from 'redis';

const client = createClient({
  url: 'redis://host.docker.internal:6379'
});

client.on('error', err => console.log('Redis Client Error', err));

await client.connect();

console.log('Redis connected');

export default client;
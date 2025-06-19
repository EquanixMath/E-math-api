import { Hono } from 'hono';

const hello = new Hono();

hello.get('/', (c) => c.json({"test": true}));
hello.post('/', (c) => c.text('Create a user'));

export default hello;

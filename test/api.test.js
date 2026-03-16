const request = require('supertest');
const app = require('../app');

describe('API Endpoints', () => {
    it('should return a 200 status for the root endpoint', async () => {
        const response = await request(app).get('/');
        expect(response.status).toBe(200);
    });

    it('should return a 404 status for a non-existent endpoint', async () => {
        const response = await request(app).get('/non-existent');
        expect(response.status).toBe(404);
    });
});
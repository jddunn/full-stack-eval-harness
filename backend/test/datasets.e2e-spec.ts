import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('DatasetsController (e2e)', () => {
  let app: INestApplication;
  let createdDatasetId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/datasets', () => {
    it('should create a new dataset', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/datasets')
        .send({
          name: 'Test Dataset',
          description: 'A test dataset for e2e testing',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Dataset');
      expect(response.body.description).toBe('A test dataset for e2e testing');

      createdDatasetId = response.body.id;
    });
  });

  describe('GET /api/datasets', () => {
    it('should return list of datasets', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/datasets')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/datasets/:id', () => {
    it('should return a specific dataset', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/datasets/${createdDatasetId}`)
        .expect(200);

      expect(response.body.id).toBe(createdDatasetId);
      expect(response.body.name).toBe('Test Dataset');
      expect(response.body).toHaveProperty('testCases');
    });

    it('should return 404 for non-existent dataset', async () => {
      await request(app.getHttpServer())
        .get('/api/datasets/non-existent-id')
        .expect(404);
    });
  });

  describe('POST /api/datasets/:id/cases', () => {
    it('should add a test case to dataset', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/datasets/${createdDatasetId}/cases`)
        .send({
          input: 'What is 2+2?',
          expectedOutput: '4',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.input).toBe('What is 2+2?');
      expect(response.body.expectedOutput).toBe('4');
    });
  });

  describe('DELETE /api/datasets/:id', () => {
    it('should delete the dataset', async () => {
      await request(app.getHttpServer())
        .delete(`/api/datasets/${createdDatasetId}`)
        .expect(200);

      // Verify it's deleted
      await request(app.getHttpServer())
        .get(`/api/datasets/${createdDatasetId}`)
        .expect(404);
    });
  });
});

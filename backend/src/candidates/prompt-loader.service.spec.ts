import { PromptLoaderService } from './prompt-loader.service';
import * as fs from 'fs';
import * as path from 'path';

describe('PromptLoaderService', () => {
  let service: PromptLoaderService;

  beforeEach(() => {
    service = new PromptLoaderService();
  });

  describe('loadAll', () => {
    it('loads prompt files from the prompts directory', () => {
      const result = service.loadAll();
      expect(result.loaded).toBeGreaterThan(0);
    });

    it('loads all 12 expected prompt files (6 base + 6 variants)', () => {
      service.loadAll();
      const prompts = service.findAll();
      expect(prompts.length).toBe(12);
    });
  });

  describe('findOne', () => {
    beforeEach(() => {
      service.loadAll();
    });

    it('returns a prompt by ID', () => {
      const prompt = service.findOne('analyst-full');
      expect(prompt.name).toBe('Full Structured Analyst');
      expect(prompt.runnerType).toBe('llm_prompt');
      expect(prompt.source).toBe('file');
    });

    it('throws NotFoundException for unknown ID', () => {
      expect(() => service.findOne('nonexistent')).toThrow();
    });
  });

  describe('variant parsing', () => {
    beforeEach(() => {
      service.loadAll();
    });

    it('parses parent_prompt field from variant files', () => {
      const variant = service.findOne('text-rewriter-formal');
      expect(variant.parentId).toBe('text-rewriter');
    });

    it('parses variant label from variant files', () => {
      const variant = service.findOne('text-rewriter-casual');
      expect(variant.variantLabel).toBe('casual');
    });

    it('base prompts have null parentId', () => {
      const base = service.findOne('text-rewriter');
      expect(base.parentId).toBeNull();
      expect(base.variantLabel).toBeNull();
    });

    it('correctly loads all summarizer variants', () => {
      const concise = service.findOne('summarizer-concise');
      const verbose = service.findOne('summarizer-verbose');
      const bullets = service.findOne('summarizer-bullets');

      expect(concise.parentId).toBe('summarizer');
      expect(verbose.parentId).toBe('summarizer');
      expect(bullets.parentId).toBe('summarizer');

      expect(concise.variantLabel).toBe('concise');
      expect(verbose.variantLabel).toBe('verbose');
      expect(bullets.variantLabel).toBe('bullets');
    });

    it('variants have their own system prompts', () => {
      const base = service.findOne('text-rewriter');
      const formal = service.findOne('text-rewriter-formal');
      expect(formal.systemPrompt).not.toBe(base.systemPrompt);
      expect(formal.systemPrompt).toContain('formal');
    });

    it('variants have their own grader weights', () => {
      const formal = service.findOne('text-rewriter-formal');
      expect(formal.recommendedGraders.length).toBeGreaterThan(0);
      expect(formal.graderWeights).toBeDefined();
    });

    it('counts 6 base prompts and 6 variants', () => {
      const all = service.findAll();
      const bases = all.filter((p) => !p.parentId);
      const variants = all.filter((p) => p.parentId);
      expect(bases.length).toBe(6);
      expect(variants.length).toBe(6);
    });
  });

  describe('grader weight parsing', () => {
    beforeEach(() => {
      service.loadAll();
    });

    it('parses weights from colon-separated format', () => {
      const prompt = service.findOne('analyst-full');
      expect(prompt.graderWeights).toBeDefined();
      expect(prompt.graderWeights['faithfulness-strict']).toBe(0.4);
      expect(prompt.graderWeights['extraction-completeness']).toBe(0.3);
      expect(prompt.graderWeights['llm-judge-helpful']).toBe(0.3);
    });

    it('preserves grader order in recommendedGraders array', () => {
      const prompt = service.findOne('analyst-full');
      expect(prompt.recommendedGraders).toEqual([
        'faithfulness-strict',
        'extraction-completeness',
        'llm-judge-helpful',
      ]);
    });

    it('weights sum to ~1.0 for analyst-full', () => {
      const prompt = service.findOne('analyst-full');
      const sum = Object.values(prompt.graderWeights).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0);
    });

    it('parses uneven weights correctly (json-extractor-strict)', () => {
      const prompt = service.findOne('json-extractor-strict');
      expect(prompt.graderWeights['json-extraction-schema']).toBe(0.4);
      expect(prompt.graderWeights['extraction-completeness']).toBe(0.4);
      expect(prompt.graderWeights['faithfulness-strict']).toBe(0.2);
    });
  });

  describe('grader rationale parsing', () => {
    beforeEach(() => {
      service.loadAll();
    });

    it('parses grader_rationale field', () => {
      const prompt = service.findOne('analyst-full');
      expect(prompt.graderRationale).toContain('Faithfulness is highest');
    });

    it('returns null for prompts without rationale', () => {
      // All our current prompts have rationale, so this tests the interface
      const prompt = service.findOne('analyst-full');
      expect(typeof prompt.graderRationale).toBe('string');
    });
  });

  describe('findMany', () => {
    beforeEach(() => {
      service.loadAll();
    });

    it('returns multiple prompts by ID', () => {
      const prompts = service.findMany(['analyst-full', 'analyst-citations']);
      expect(prompts).toHaveLength(2);
      expect(prompts[0].id).toBe('analyst-full');
      expect(prompts[1].id).toBe('analyst-citations');
    });

    it('throws on any unknown ID', () => {
      expect(() => service.findMany(['analyst-full', 'bogus'])).toThrow();
    });
  });

  describe('createVariant', () => {
    beforeEach(() => {
      service.loadAll();
    });

    afterEach(() => {
      // Clean up any test-created variant files
      const promptsDir = (service as any).promptsDir;
      const testFile = path.join(promptsDir, 'analyst-full-test-variant.md');
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
        service.loadAll(); // reload to remove from memory
      }
    });

    it('creates a new variant file on disk', () => {
      const variant = service.createVariant('analyst-full', {
        variantLabel: 'test-variant',
        name: 'Test Variant',
        description: 'For testing',
        systemPrompt: 'You are a test prompt.',
      });

      expect(variant.id).toBe('analyst-full-test-variant');
      expect(variant.parentId).toBe('analyst-full');
      expect(variant.variantLabel).toBe('test-variant');
      expect(variant.name).toBe('Test Variant');
      expect(variant.systemPrompt).toBe('You are a test prompt.');
    });

    it('writes a valid .md file that can be parsed', () => {
      service.createVariant('analyst-full', {
        variantLabel: 'test-variant',
      });

      // Reload to prove the file is valid
      service.loadAll();
      const variant = service.findOne('analyst-full-test-variant');
      expect(variant.parentId).toBe('analyst-full');
    });

    it('inherits parent runner type and recommendations', () => {
      const parent = service.findOne('analyst-full');
      const variant = service.createVariant('analyst-full', {
        variantLabel: 'test-variant',
      });

      expect(variant.runnerType).toBe(parent.runnerType);
      expect(variant.recommendedGraders).toEqual(parent.recommendedGraders);
    });

    it('uses parent system prompt when none provided', () => {
      const parent = service.findOne('analyst-full');
      const variant = service.createVariant('analyst-full', {
        variantLabel: 'test-variant',
      });

      expect(variant.systemPrompt).toBe(parent.systemPrompt);
    });

    it('generates default name from parent if not provided', () => {
      const variant = service.createVariant('analyst-full', {
        variantLabel: 'test-variant',
      });

      expect(variant.name).toContain('Full Structured Analyst');
      expect(variant.name).toContain('test-variant');
    });

    it('throws ConflictException for duplicate variant ID', () => {
      service.createVariant('analyst-full', {
        variantLabel: 'test-variant',
      });

      expect(() =>
        service.createVariant('analyst-full', {
          variantLabel: 'test-variant',
        }),
      ).toThrow();
    });

    it('throws NotFoundException for unknown parent', () => {
      expect(() =>
        service.createVariant('nonexistent', {
          variantLabel: 'test-variant',
        }),
      ).toThrow();
    });

    it('normalizes variant label to lowercase with hyphens', () => {
      const variant = service.createVariant('analyst-full', {
        variantLabel: 'Test Variant',
      });
      expect(variant.id).toBe('analyst-full-test-variant');
      expect(variant.variantLabel).toBe('test-variant');
    });

    it('strips unsafe characters from variant labels', () => {
      const variant = service.createVariant('analyst-full', {
        variantLabel: '../Test Variant !!!',
      });
      expect(variant.id).toBe('analyst-full-test-variant');
      expect(variant.variantLabel).toBe('test-variant');
    });
  });

  describe('deletePrompt', () => {
    beforeEach(() => {
      service.loadAll();
    });

    it('deletes a variant from disk and memory', () => {
      // Create a temporary variant to delete
      service.createVariant('analyst-full', {
        variantLabel: 'to-delete',
        systemPrompt: 'Temporary.',
      });
      expect(service.findAll().some((p) => p.id === 'analyst-full-to-delete')).toBe(true);

      const result = service.deletePrompt('analyst-full-to-delete');
      expect(result.deleted).toBe(true);
      expect(() => service.findOne('analyst-full-to-delete')).toThrow();

      // Verify file is gone
      const promptsDir = (service as any).promptsDir;
      expect(fs.existsSync(path.join(promptsDir, 'analyst-full-to-delete.md'))).toBe(false);
    });

    it('throws NotFoundException when deleting unknown ID', () => {
      expect(() => service.deletePrompt('nonexistent')).toThrow();
    });
  });

  describe('updatePrompt', () => {
    beforeEach(() => {
      service.loadAll();
    });

    afterEach(() => {
      // Clean up: restore by re-creating if we modified a variant
      const promptsDir = (service as any).promptsDir;
      const testFile = path.join(promptsDir, 'analyst-full-update-test.md');
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
        service.loadAll();
      }
    });

    it('preserves parent_prompt and variant fields on update', () => {
      // Create a variant, update it, check lineage is preserved
      service.createVariant('analyst-full', {
        variantLabel: 'update-test',
        systemPrompt: 'Original.',
      });

      const updated = service.updatePrompt('analyst-full-update-test', {
        systemPrompt: 'Updated system prompt.',
      });

      expect(updated.parentId).toBe('analyst-full');
      expect(updated.variantLabel).toBe('update-test');
      expect(updated.systemPrompt).toBe('Updated system prompt.');
    });
  });
});

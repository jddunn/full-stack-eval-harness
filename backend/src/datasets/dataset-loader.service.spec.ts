import { DatasetLoaderService } from './dataset-loader.service';

describe('DatasetLoaderService', () => {
  let service: DatasetLoaderService;

  beforeEach(() => {
    service = new DatasetLoaderService();
  });

  describe('loadAll', () => {
    it('loads CSV files from the datasets directory', () => {
      const result = service.loadAll();
      expect(result.loaded).toBeGreaterThan(0);
    });

    it('loads all expected CSV files', () => {
      service.loadAll();
      const datasets = service.findAll();
      expect(datasets.length).toBe(2);
    });
  });

  describe('findOne', () => {
    beforeEach(() => {
      service.loadAll();
    });

    it('returns a dataset by ID', () => {
      const dataset = service.findOne('context-qa');
      expect(dataset.name).toBe('Q&A with Context');
      expect(dataset.source).toBe('file');
      expect(dataset.testCaseCount).toBe(3);
    });

    it('includes test cases with deterministic IDs', () => {
      const dataset = service.findOne('context-qa');
      expect(dataset.testCases[0].id).toBe('context-qa-0');
      expect(dataset.testCases[1].id).toBe('context-qa-1');
      expect(dataset.testCases[2].id).toBe('context-qa-2');
    });

    it('parses test case fields correctly', () => {
      const dataset = service.findOne('context-qa');
      const tc = dataset.testCases[0];
      expect(tc.input).toBe('When was the company founded?');
      expect(tc.expectedOutput).toBe('The company was founded in 2015.');
      expect(tc.context).toContain('Acme Corp');
      expect(tc.datasetId).toBe('context-qa');
    });

    it('throws NotFoundException for unknown ID', () => {
      expect(() => service.findOne('nonexistent')).toThrow();
    });
  });

  describe('findMany', () => {
    beforeEach(() => {
      service.loadAll();
    });

    it('returns multiple datasets by ID', () => {
      const datasets = service.findMany(['context-qa', 'research-paper-extraction']);
      expect(datasets).toHaveLength(2);
      expect(datasets[0].id).toBe('context-qa');
      expect(datasets[1].id).toBe('research-paper-extraction');
    });

    it('throws on any unknown ID', () => {
      expect(() => service.findMany(['context-qa', 'bogus'])).toThrow();
    });
  });

  describe('research-paper-extraction dataset', () => {
    beforeEach(() => {
      service.loadAll();
    });

    it('has 5 test cases', () => {
      const dataset = service.findOne('research-paper-extraction');
      expect(dataset.testCaseCount).toBe(5);
    });

    it('has JSON expected output', () => {
      const dataset = service.findOne('research-paper-extraction');
      const tc = dataset.testCases[0];
      expect(tc.expectedOutput).toBeTruthy();
      const parsed = JSON.parse(tc.expectedOutput!);
      expect(parsed.title).toBe('Attention Is All You Need');
      expect(parsed.authors).toContain('Ashish Vaswani');
    });

    it('reads meta.json for name and description', () => {
      const dataset = service.findOne('research-paper-extraction');
      expect(dataset.name).toBe('Research Paper Extraction');
      expect(dataset.description).toBe('5 real AI paper abstracts for structured JSON extraction');
    });
  });

  describe('CSV parsing', () => {
    it('handles quoted fields with commas', () => {
      const csv = 'input,expected_output,context,metadata\n"Hello, world","output","ctx",""';
      const result = service.parseCsv('test', csv);
      expect(result[0].input).toBe('Hello, world');
    });

    it('handles escaped double quotes', () => {
      const csv = 'input,expected_output,context,metadata\n"She said ""hello""","out","",""';
      const result = service.parseCsv('test', csv);
      expect(result[0].input).toBe('She said "hello"');
    });

    it('handles newlines within quoted fields', () => {
      const csv = 'input,expected_output,context,metadata\n"Line 1\nLine 2","out","",""';
      const result = service.parseCsv('test', csv);
      expect(result[0].input).toBe('Line 1\nLine 2');
    });

    it('skips empty rows', () => {
      const csv = 'input,expected_output,context,metadata\n"q1","a1","",""\n\n"q2","a2","",""';
      const result = service.parseCsv('test', csv);
      expect(result).toHaveLength(2);
    });

    it('generates deterministic IDs', () => {
      const csv = 'input,expected_output,context,metadata\n"q1","a1","",""\n"q2","a2","",""';
      const result = service.parseCsv('my-ds', csv);
      expect(result[0].id).toBe('my-ds-0');
      expect(result[1].id).toBe('my-ds-1');
    });

    it('parses metadata JSON', () => {
      const csv = 'input,expected_output,context,metadata\n"q1","a1","","{""difficulty"":""hard""}"';
      const result = service.parseCsv('test', csv);
      expect(result[0].metadata).toEqual({ difficulty: 'hard' });
    });

    it('ignores invalid metadata JSON', () => {
      const csv = 'input,expected_output,context,metadata\n"q1","a1","","not json"';
      const result = service.parseCsv('test', csv);
      expect(result[0].metadata).toBeNull();
    });

    it('parses custom columns into customFields', () => {
      const csv =
        'input,expected_output,difficulty,topic\n"q1","a1","hard","math"';
      const result = service.parseCsv('test', csv);
      expect(result[0].customFields).toEqual({
        difficulty: 'hard',
        topic: 'math',
      });
    });

    it('throws if input column is missing', () => {
      const csv = 'question,answer\n"q1","a1"';
      expect(() => service.parseCsv('test', csv)).toThrow('missing required "input" column');
    });
  });
});

import { RecipientParser } from '../src/utils/csv-parser';

describe('RecipientParser', () => {
  it('should parse valid comma and newline separated emails', () => {
    const raw = 'test1@example.com\ntest2@example.com,test3@domain.org';
    const result = RecipientParser.parse(raw);

    expect(result.valid).toEqual(['test1@example.com', 'test2@example.com', 'test3@domain.org']);
    expect(result.invalid).toHaveLength(0);
    expect(result.duplicates).toHaveLength(0);
    expect(result.total).toBe(3);
  });

  it('should remove duplicates and normalize lowercase', () => {
    const raw = 'Alice@Company.com\nalice@company.com\nBob@Company.com';
    const result = RecipientParser.parse(raw);

    expect(result.valid).toEqual(['alice@company.com', 'bob@company.com']);
    expect(result.duplicates).toEqual(['alice@company.com']);
    expect(result.total).toBe(3);
  });

  it('should flag invalid email addresses with descriptive reasons', () => {
    const raw = 'valid@example.com\nnot-an-email\nmissingdomain@.com';
    const result = RecipientParser.parse(raw);

    expect(result.valid).toEqual(['valid@example.com']);
    expect(result.invalid).toHaveLength(2);
    expect(result.invalid[0].email).toBe('not-an-email');
  });

  it('should handle CSV format with header row named email', () => {
    const csv = `email,name\nuser1@test.com,User One\nuser2@test.com,User Two`;
    const result = RecipientParser.parse(csv);

    expect(result.valid).toEqual(['user1@test.com', 'user2@test.com']);
  });
});

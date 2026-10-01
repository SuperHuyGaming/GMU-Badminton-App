const fs = require('fs');
let content = fs.readFileSync('tests/challenge_stress.test.js', 'utf8');

// Replace mock in 4.1
content = content.replace(/User\.find\.mockImplementation\(\(query\) => \{\s*capturedQuery = query;\s*return \{\s*select: jest\.fn\(\)\.mockReturnValue\(\{\s*sort: jest\.fn\(\)\.mockReturnValue\(\{\s*limit: jest\.fn\(\)\.mockReturnValue\(\{\s*lean: jest\.fn\(\)\.mockResolvedValue\(\[\]\),\s*\}\),\s*\}\),\s*limit: jest\.fn\(\)\.mockReturnValue\(\{\s*lean: jest\.fn\(\)\.mockResolvedValue\(\[\]\),\s*\}\),\s*\}\),\s*\}\;\s*\}\);/g, 
\User.find.mockImplementation((query) => {
                capturedQuery = query;
                return {
                    select: jest.fn().mockReturnValue({
                        sort: jest.fn().mockReturnValue({
                            limit: jest.fn().mockReturnValue({
                                lean: jest.fn().mockResolvedValue([]),
                            }),
                        }),
                    }),
                };
            });
            User.aggregate.mockResolvedValue([]);\);

// Replace mock in 4.2
content = content.replace(/User\.find\.mockImplementation\(\(query\) => \{\s*capturedQuery = query;\s*return \{\s*select: jest\.fn\(\)\.mockReturnValue\(\{\s*sort: jest\.fn\(\)\.mockReturnValue\(\{\s*limit: jest\.fn\(\)\.mockReturnValue\(\{\s*lean: jest\.fn\(\)\.mockResolvedValue\(\[\]\),\s*\}\),\s*\}\),\s*limit: jest\.fn\(\)\.mockReturnValue\(\{\s*lean: jest\.fn\(\)\.mockResolvedValue\(\[\]\),\s*\}\),\s*\}\),\s*\}\;\s*\}\);/g, 
\User.find.mockImplementation((query) => {
                capturedQuery = query;
                return {
                    select: jest.fn().mockReturnValue({
                        sort: jest.fn().mockReturnValue({
                            limit: jest.fn().mockReturnValue({
                                lean: jest.fn().mockResolvedValue([]),
                            }),
                        }),
                    }),
                };
            });
            User.aggregate.mockResolvedValue([]);\);

// Replace mock in 4.3
content = content.replace(/User\.find\.mockReturnValue\(\{\s*select: jest\.fn\(\)\.mockReturnValue\(\{\s*sort: jest\.fn\(\)\.mockReturnValue\(\{\s*limit: jest\.fn\(\)\.mockReturnValue\(\{\s*lean: jest\.fn\(\)\.mockResolvedValue\(\[\]\),\s*\}\),\s*\}\),\s*limit: jest\.fn\(\)\.mockReturnValue\(\{\s*lean: jest\.fn\(\)\.mockResolvedValue\(\[\]\),\s*\}\),\s*\}\),\s*\}\);/g, 
\User.find.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    sort: jest.fn().mockReturnValue({
                        limit: jest.fn().mockReturnValue({
                            lean: jest.fn().mockResolvedValue([]),
                        }),
                    }),
                }),
            });
            User.aggregate.mockResolvedValue([]);\);

// Replace mock in 4.4
content = content.replace(/User\.find\s*\.mockReturnValueOnce\(\{\s*select: jest\.fn\(\)\.mockReturnValue\(\{\s*sort: jest\.fn\(\)\.mockReturnValue\(\{\s*limit: jest\.fn\(\)\.mockReturnValue\(\{\s*lean: jest\.fn\(\)\.mockResolvedValue\(mockMatches\),\s*\}\),\s*\}\),\s*\}\),\s*\}\)\s*\.mockReturnValueOnce\(\{\s*select: jest\.fn\(\)\.mockReturnValue\(\{\s*limit: jest\.fn\(\)\.mockReturnValue\(\{\s*lean: jest\.fn\(\)\.mockResolvedValue\(mockRecommended\),\s*\}\),\s*\}\),\s*\}\);/g, 
\User.find.mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    sort: jest.fn().mockReturnValue({
                        limit: jest.fn().mockReturnValue({
                            lean: jest.fn().mockResolvedValue(mockMatches),
                        }),
                    }),
                }),
            });
            User.aggregate.mockResolvedValueOnce(mockRecommended);\);

fs.writeFileSync('tests/challenge_stress.test.js', content);

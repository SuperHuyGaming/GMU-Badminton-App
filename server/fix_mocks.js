const fs = require('fs');
let content = fs.readFileSync('tests/matchmaking.test.js', 'utf8');

// Replace the mock for discover (first occurrence)
content = content.replace(/User\.find\s*\.mockReturnValueOnce\(\{\s*select: jest\.fn\(\)\.mockReturnValue\(\{\s*sort: jest\.fn\(\)\.mockReturnValue\(\{\s*limit: jest\.fn\(\)\.mockReturnValue\(\{\s*lean: jest\.fn\(\)\.mockResolvedValue\(mockMatches\)\s*\}\)\s*\}\)\s*\}\)\s*\}\)\s*\.mockReturnValueOnce\(\{\s*select: jest\.fn\(\)\.mockReturnValue\(\{\s*limit: jest\.fn\(\)\.mockReturnValue\(\{\s*lean: jest\.fn\(\)\.mockResolvedValue\(mockRecommended\)\s*\}\)\s*\}\)\s*\}\);/g, 
`User.find.mockReturnValueOnce({
                    select: jest.fn().mockReturnValue({
                        sort: jest.fn().mockReturnValue({
                            limit: jest.fn().mockReturnValue({
                                lean: jest.fn().mockResolvedValue(mockMatches)
                            })
                        })
                    })
                });
            User.aggregate.mockResolvedValueOnce(mockRecommended);`);

// Replace the second occurrence
content = content.replace(/User\.find\s*\.mockReturnValueOnce\(\{\s*select: jest\.fn\(\)\.mockReturnValue\(\{\s*sort: jest\.fn\(\)\.mockReturnValue\(\{\s*limit: jest\.fn\(\)\.mockReturnValue\(\{\s*lean: jest\.fn\(\)\.mockResolvedValue\(\[\]\)\s*\}\)\s*\}\)\s*\}\)\s*\}\)\s*\.mockReturnValueOnce\(\{\s*select: jest\.fn\(\)\.mockReturnValue\(\{\s*limit: jest\.fn\(\)\.mockReturnValue\(\{\s*lean: jest\.fn\(\)\.mockResolvedValue\(\[\]\)\s*\}\)\s*\}\)\s*\}\);/g,
`User.find.mockReturnValueOnce({
                    select: jest.fn().mockReturnValue({
                        sort: jest.fn().mockReturnValue({
                            limit: jest.fn().mockReturnValue({
                                lean: jest.fn().mockResolvedValue([])
                            })
                        })
                    })
                });
            User.aggregate.mockResolvedValueOnce([]);`);

// Replace third occurrence
content = content.replace(/User\.find\s*\.mockReturnValueOnce\(\{\s*select: jest\.fn\(\)\.mockReturnValue\(\{\s*sort: jest\.fn\(\)\.mockReturnValue\(\{\s*limit: jest\.fn\(\)\.mockReturnValue\(\{\s*lean: jest\.fn\(\)\.mockResolvedValue\(mockMatches\)\s*\}\)\s*\}\)\s*\}\)\s*\}\)\s*\.mockReturnValueOnce\(\{\s*select: jest\.fn\(\)\.mockReturnValue\(\{\s*limit: jest\.fn\(\)\.mockReturnValue\(\{\s*lean: jest\.fn\(\)\.mockResolvedValue\(\[\]\)\s*\}\)\s*\}\)\s*\}\);/g,
`User.find.mockReturnValueOnce({
                    select: jest.fn().mockReturnValue({
                        sort: jest.fn().mockReturnValue({
                            limit: jest.fn().mockReturnValue({
                                lean: jest.fn().mockResolvedValue(mockMatches)
                            })
                        })
                    })
                });
            User.aggregate.mockResolvedValueOnce([]);`);


// Replace fourth occurrence (handles null/unpopulated)
content = content.replace(/User\.find\.mockReturnValue\(\{\s*select: jest\.fn\(\)\.mockReturnValue\(\{\s*sort: jest\.fn\(\)\.mockReturnValue\(\{\s*limit: jest\.fn\(\)\.mockReturnValue\(\{\s*lean: jest\.fn\(\)\.mockResolvedValue\(\[\]\)\s*\}\)\s*\}\),\s*limit: jest\.fn\(\)\.mockReturnValue\(\{\s*lean: jest\.fn\(\)\.mockResolvedValue\(\[\]\)\s*\}\)\s*\}\)\s*\}\);/g,
`User.find.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    sort: jest.fn().mockReturnValue({
                        limit: jest.fn().mockReturnValue({
                            lean: jest.fn().mockResolvedValue([])
                        })
                    })
                })
            });
            User.aggregate.mockResolvedValue([]);`);

fs.writeFileSync('tests/matchmaking.test.js', content);

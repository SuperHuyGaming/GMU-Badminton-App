const fs = require('fs');
let file = 'server/routes/matchmaking.js';
let content = fs.readFileSync(file, 'utf8');

// The end of the first aggregation pipeline
content = content.replace(
`                                _id: "$friend._id",
                                name: "$friend.name",
                                profilePic: "$friend.profilePic"
                            }
                        }
                    }
                }
        ]);`, 
`                                _id: "$friend._id",
                                name: "$friend.name",
                                profilePic: "$friend.profilePic"
                            }
                        }
                    }
                } }
        ]);`);

// The end of the second aggregation pipeline
content = content.replace(
`                                    _id: "$friend._id",
                                    name: "$friend.name",
                                    profilePic: "$friend.profilePic"
                                }
                            }
                        }
                    }
            ]);`,
`                                    _id: "$friend._id",
                                    name: "$friend.name",
                                    profilePic: "$friend.profilePic"
                                }
                            }
                        }
                    } }
            ]);`);

fs.writeFileSync(file, content);

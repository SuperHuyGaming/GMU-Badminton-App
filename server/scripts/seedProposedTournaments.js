/**
 * Seed Script: Ingest sample DMV badminton proposals into ProposedTournament collection
 * Run: node server/scripts/seedProposedTournaments.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const ProposedTournament = require('../models/ProposedTournament');

const sampleProposals = [
    {
        sourceUrl: 'https://instagram.com/p/gmu_spring_open_2027',
        confidenceScore: 94,
        rawCaption: '🏸 GMU Badminton Club Spring Invitational 2027 is here!\nJoin us at the Recreation and Athletic Complex (RAC) on Fairfax Campus.\nEvents: Men’s & Women’s Singles, Doubles, and Mixed.\nEntry fee: $30/first event, $15/additional event.\nRegistration deadline: April 1, 2027.',
        scrapedImageUrls: [
            'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&auto=format&fit=crop'
        ],
        sourceLinks: [
            'https://mason360.gmu.edu/badminton/tournament',
            'https://forms.gle/sampleGmuOpen2027'
        ],
        tournamentName: 'GMU Spring Invitational 2027',
        date: new Date('2027-04-10T09:00:00.000Z'),
        location: 'RAC Gym, George Mason University, Fairfax, VA',
        entryFee: '$30',
        registrationLink: 'https://mason360.gmu.edu/badminton/tournament',
        skillLevels: ['Beginner', 'Intermediate', 'Advanced'],
        registrationDeadline: new Date('2027-04-01T23:59:59.000Z'),
        status: 'pending'
    },
    {
        sourceUrl: 'https://instagram.com/p/umd_terp_classic_2027',
        confidenceScore: 91,
        rawCaption: '🐢 UMD Terrapin Badminton Classic 2027!\nHosted at Ritchie Coliseum, College Park MD.\nOpen to all collegiate and DMV community players.\nFlight divisions: A/B/C.\nRegister now on tournament software or link in bio!',
        scrapedImageUrls: [
            'https://images.unsplash.com/photo-1521537634581-0dced2fee2ef?w=800&auto=format&fit=crop'
        ],
        sourceLinks: [
            'https://recwell.umd.edu/badminton-classic'
        ],
        tournamentName: 'UMD Terrapin Badminton Classic 2027',
        date: new Date('2027-05-01T08:30:00.000Z'),
        location: 'Ritchie Coliseum, College Park, MD',
        entryFee: '$35',
        registrationLink: 'https://recwell.umd.edu/badminton-classic',
        skillLevels: ['Intermediate', 'Advanced', 'Open'],
        registrationDeadline: new Date('2027-04-20T23:59:59.000Z'),
        status: 'pending'
    },
    {
        sourceUrl: 'https://instagram.com/p/capital_badminton_cup_2027',
        confidenceScore: 88,
        rawCaption: '🏆 Capital Badminton Open Cup 2027.\nPrize purse $2,000 across all open categories.\nVenue: Capital Badminton Club Columbia MD.\nRegistration deadline: May 10, 2027.',
        scrapedImageUrls: [
            'https://images.unsplash.com/photo-1544919982-b61976f0ba43?w=800&auto=format&fit=crop'
        ],
        sourceLinks: [
            'https://www.capitalbadminton.com/cup2027'
        ],
        tournamentName: 'Capital Badminton Open Cup 2027',
        date: new Date('2027-05-22T09:00:00.000Z'),
        location: 'Capital Badminton Club, Columbia, MD',
        entryFee: '$40',
        registrationLink: 'https://www.capitalbadminton.com/cup2027',
        skillLevels: ['Beginner', 'Intermediate', 'Advanced', 'Open'],
        registrationDeadline: new Date('2027-05-10T23:59:59.000Z'),
        status: 'pending'
    }
];

async function seed() {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
        console.warn('⚠️ No MONGO_URI in .env. Skipping live database seed.');
        return;
    }

    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB.');

        for (const item of sampleProposals) {
            const exists = await ProposedTournament.findOne({ tournamentName: item.tournamentName });
            if (!exists) {
                await ProposedTournament.create(item);
                console.log(`✅ Seeded proposal: ${item.tournamentName}`);
            } else {
                console.log(`ℹ️ Already exists: ${item.tournamentName}`);
            }
        }
    } catch (err) {
        console.error('Error seeding proposed tournaments:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB.');
    }
}

if (require.main === module) {
    seed();
}

module.exports = { sampleProposals, seed };

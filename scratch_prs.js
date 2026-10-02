async function checkPRs() {
    const res = await fetch('https://api.github.com/repos/SuperHuyGaming/GMU-Badminton-App/pulls?state=open');
    const prs = await res.json();
    if (prs.length === 0) {
        console.log("No open pull requests found!");
        return;
    }
    console.log(`Found ${prs.length} open PRs:`);
    prs.forEach(pr => {
        console.log(`- #${pr.number}: ${pr.title} [${pr.head.ref}]`);
    });
}
checkPRs();

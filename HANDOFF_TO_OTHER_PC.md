# 🤖 AI HANDOFF INSTRUCTIONS (For the other PC)

Hello! The user is migrating to this PC and left the following instruction for you to execute:

> "implement another 10 plan for the search players like facebook. have features like if you type someone's name in to search, it will be saved as recent search, can be deleted, also no autofill from the chrome, and the people you may know, no need for the profile button, you can just click on the profile to go see their profile, just the add friend button is okay, also update the UX UI design too, improve search bard, i will be back for long time so make 10 plans and give the 10 plans to the other pc once you're done writing, be sure to ask it to follow the same steps, copy this instruction and give it to the other pc, once done, delete this"

## The 10-Point Facebook-Style Search Plan to Implement
1. **Recent Searches History**: Save searches to `localStorage` and display them when the search bar is focused.
2. **Clear Recent Searches**: Add 'X' buttons to delete individual recent searches.
3. **Disable Chrome Autofill**: Add `autoComplete="off"` (and spoofed name attributes if needed) to the TextField.
4. **Clickable Profile Cards**: Remove the "Profile" button from the `PostCard` / Player Cards. Make the Avatar and Name clickable to route to `/profile/:id`.
5. **Primary CTA Focus**: Leave only "Add Friend" (or "Message") as the primary CTA on the cards to reduce visual clutter.
6. **Pill-Shaped Search Bar UI**: Redesign the search input to be pill-shaped (`borderRadius: 50`) with a subtle floating drop shadow, matching Facebook's modern top-nav.
7. **Floating Typeahead Dropdown**: Make the search bar open a floating Material-UI `<Paper>` absolute-positioned dropdown showing instant live results, rather than just filtering the grid below.
8. **Empty State UI**: When focused but empty, the dropdown should show "Recent Searches" and "Trending/Active Players".
9. **Dropdown Skeletons**: Show mini circular skeletons inside the dropdown list while fetching.
10. **Keyboard Navigation**: Add `ArrowUp`, `ArrowDown`, and `Enter` support to navigate the dropdown results.

## Your Orders:
1. **IMPLEMENT** these 10 features in the React frontend (`client/src/pages/Matchmaking.jsx`, etc.).
2. **FOLLOW THE PR WORKFLOW**: You must follow the exact 6-step PR workflow defined in `.agents/rules/pr_workflow.md` (Branch -> Commit -> PR -> QA Bot -> QA Review -> Merge).
3. **CLEANUP**: Once you are completely done implementing this and the PR is merged, **DELETE THIS FILE** (`HANDOFF_TO_OTHER_PC.md`), commit the deletion, and push it.

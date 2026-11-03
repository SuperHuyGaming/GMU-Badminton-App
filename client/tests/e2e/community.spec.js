import { test, expect } from '@playwright/test';
import { stubApi, signInAs, PLAYER } from './helpers.js';

const json = (body, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

// GET /api/feed?tab=... (not /api/feed/trending-tags)
const FEED_LIST = /\/api\/feed\?/;

test.describe('Community posting', () => {
  test.beforeEach(async ({ page }) => {
    await stubApi(page);
    await signInAs(page, PLAYER);
    await page.route(FEED_LIST, (route) =>
      route.fulfill(json({ feed: [], nextCursor: null, hasMore: false }))
    );
  });

  test('player writes a post and it appears at the top of the feed', async ({ page }) => {
    let posted = null;
    await page.route('**/api/forum', (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      posted = route.request().postDataJSON();
      return route.fulfill(json({
        _id: 'post-e2e-1',
        type: 'post',
        title: posted.title,
        content: posted.content,
        category: posted.category,
        authorName: PLAYER.name,
        author: { _id: PLAYER._id, name: PLAYER.name },
        authorId: PLAYER._id,
        visibility: 'PUBLIC',
        createdAt: new Date().toISOString(),
        reactions: [],
        comments: [],
      }, 201));
    });

    await page.goto('/community');
    await page.getByTestId('facebook-composer-card').click();

    const dialog = page.getByRole('dialog');
    const postBtn = dialog.getByRole('button', { name: 'Post', exact: true });
    // Empty posts cannot be submitted.
    await expect(postBtn).toBeDisabled();

    await dialog.getByPlaceholder(/what's on your mind/i).fill('Anyone up for doubles at the RAC tonight?');
    await expect(postBtn).toBeEnabled();
    await postBtn.click();

    await expect(page.getByText('Post created successfully!')).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Anyone up for doubles at the RAC tonight?').filter({ visible: true }).first()).toBeVisible();

    expect(posted).toMatchObject({
      content: 'Anyone up for doubles at the RAC tonight?',
      // With no title, the first line becomes the title.
      title: 'Anyone up for doubles at the RAC tonight?',
      authorId: PLAYER._id,
      visibility: 'PUBLIC',
    });
  });

  test('shows the server error and keeps the draft when posting fails', async ({ page }) => {
    await page.route('**/api/forum', (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      return route.fulfill(json({ message: 'Post flagged by spam filter' }, 400));
    });

    await page.goto('/community');
    await page.getByTestId('facebook-composer-card').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder(/what's on your mind/i).fill('Buy cheap rackets now!!!');
    await dialog.getByRole('button', { name: 'Post', exact: true }).click();

    await expect(page.getByText('Post flagged by spam filter')).toBeVisible();
    // The dialog stays open with the text intact so the user can edit it.
    await expect(dialog.getByPlaceholder(/what's on your mind/i)).toHaveValue('Buy cheap rackets now!!!');
  });
});

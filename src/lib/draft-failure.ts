/**
 * Turns an alt-text drafting failure into something the user can act on.
 *
 * Kept out of the route so it can be tested without the Anthropic SDK and the
 * Workers bindings, both of which the route pulls in.
 *
 * The unreachable-image case is worth naming because it is both the most common
 * and the only one the user can fix: images go to the model as URLs, the API has
 * no partial success, and one dead link therefore fails the whole batch.
 * Matching on the message text is a heuristic — the fallback stays vague rather
 * than guessing at a cause.
 */
export function draftFailureMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);

  if (/image|url|fetch|download/i.test(message)) {
    return (
      "Drafting failed, most likely because one of the images could not be " +
      "fetched from its URL. Check that every image is reachable without a login " +
      "and try again. The classification below is unaffected."
    );
  }

  return "Drafting failed. The classification below is unaffected — it needs no model.";
}

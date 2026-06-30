/// The accuracy verdict a user gives a parsed receipt. The backend
/// `POST /invoices/{id}/feedback` accepts `{ verdict: 'UP' | 'DOWN' }` and stores
/// only the verdict (no reason/free-text column yet — see 16d handoff gap).
enum FeedbackVerdict {
  up,
  down;

  String get wire => this == FeedbackVerdict.up ? 'UP' : 'DOWN';
}

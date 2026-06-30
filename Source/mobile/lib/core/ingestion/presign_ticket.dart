/// The backend's `POST /invoices/presign` 201 response: the new invoice id plus
/// the presigned **multipart POST** target and the signed form fields the client
/// must submit alongside the file (see `PresignService.ts` → `{ url, fields }`).
class PresignTicket {
  const PresignTicket({
    required this.invoiceId,
    required this.url,
    required this.fields,
  });

  final String invoiceId;
  final String url;
  final Map<String, String> fields;
}

import { apiClient } from "@/services/api";

export type AppMail = {
  id: string;
  mail_type: string;
  subject: string;
  body_markdown: string;
  sent_at: string;
  read_at: string | null;
};

export type MailListResponse = {
  mails: AppMail[];
  unread_count: number;
  total: number;
};

export const mailService = {
  list: () => apiClient.get<MailListResponse>("/api/v1/mail"),

  markRead: (mailId: string) =>
    apiClient.post<{ success: boolean }>(`/api/v1/mail/${mailId}/read`),

  markAllRead: () =>
    apiClient.post<{ success: boolean }>("/api/v1/mail/read-all"),
};

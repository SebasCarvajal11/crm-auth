export type TransactionalEmailJob =
  | {
      type: "password_reset";
      to: string;
      token: string;
    }
  | {
      type: "client_invite";
      to: string;
      token: string;
    }
  | {
      type: "worker_welcome";
      to: string;
      tempPassword: string;
    }
  | {
      type: "email_verify";
      to: string;
      token: string;
    };

export interface EmailJobPublisher {
  enqueue(job: TransactionalEmailJob): Promise<void>;
}

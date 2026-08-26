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
      type: "email_verify";
      to: string;
      token: string;
    };

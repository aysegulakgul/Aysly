import { Suspense } from 'react';
import { ResetPasswordForm } from '../auth-forms';

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

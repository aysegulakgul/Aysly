import { Suspense } from 'react';
import { SignInForm } from '../auth-forms';

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}

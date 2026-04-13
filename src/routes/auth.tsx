import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { NeuInput } from '@/components/NeuInput';
import { NeuButton } from '@/components/NeuButton';
import { Church } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/auth')({
  head: () => ({
    meta: [
      { title: 'Sign In — Church Hub' },
      { name: 'description', content: 'Sign in or create your Church Hub account' },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  if (user) {
    navigate({ to: '/home' });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    if (isSignUp && !name.trim()) return;

    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email.trim(), password, name.trim());
        toast.success('Account created! Check your email to confirm.');
      } else {
        await signIn(email.trim(), password);
        toast.success('Welcome back!');
        navigate({ to: '/home' });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-background">
      <div className="w-full max-w-sm fade-in">
        <div className="flex flex-col items-center mb-10">
          <div className="neu-convex p-5 mb-4">
            <Church size={32} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Church Hub</h1>
          <p className="text-muted-foreground text-[14px] mt-1">Your spiritual content platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <NeuInput
              label="Full Name"
              placeholder="John Doe"
              value={name}
              onChange={e => setName(e.target.value)}
              autoComplete="name"
            />
          )}
          <NeuInput
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
          />
          <NeuInput
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
          />

          <div className="pt-2">
            <NeuButton type="submit" variant="primary" size="lg" isLoading={loading}>
              {isSignUp ? 'Create Account' : 'Sign In'}
            </NeuButton>
          </div>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-[14px] text-muted-foreground"
          >
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <span className="text-primary font-semibold">{isSignUp ? 'Sign In' : 'Sign Up'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

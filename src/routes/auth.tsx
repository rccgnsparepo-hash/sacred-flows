import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { NeuInput } from '@/components/NeuInput';
import { NeuButton } from '@/components/NeuButton';
import { Church, Shield, User, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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
  const [signUpRole, setSignUpRole] = useState<'user' | 'admin'>('user');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  if (user) {
    navigate({ to: '/home' });
    return null;
  }

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2MB'); return; }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    if (isSignUp && !name.trim()) return;
    if (isSignUp && signUpRole === 'admin' && !adminKey.trim()) {
      toast.error('Admin key is required');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email.trim(), password, name.trim());

        if (signUpRole === 'admin') {
          toast.info('Verifying admin key...');
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

          if (signInError) {
            toast.success('Account created! Please confirm your email first, then sign in to verify admin access.');
            setLoading(false);
            return;
          }

          if (signInData.user) {
            // Upload avatar if provided
            if (avatarFile) {
              await uploadAvatar(signInData.user.id);
            }
            // Update DOB if provided
            if (dob) {
              await supabase.from('profiles').update({ date_of_birth: dob }).eq('user_id', signInData.user.id);
            }

            const { data, error } = await supabase.functions.invoke('verify-admin-key', {
              body: { admin_key: adminKey.trim(), user_id: signInData.user.id },
            });

            if (error || data?.error) {
              toast.error(data?.error || 'Invalid admin key. You have been registered as a regular user.');
              await supabase.auth.signOut();
            } else {
              toast.success('Admin account created successfully!');
              navigate({ to: '/home' });
              setLoading(false);
              return;
            }
          }
        } else {
          // For regular users, try to sign in to upload avatar/DOB
          const { data: signInData } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

          if (signInData?.user) {
            if (avatarFile) await uploadAvatar(signInData.user.id);
            if (dob) await supabase.from('profiles').update({ date_of_birth: dob }).eq('user_id', signInData.user.id);
            toast.success('Account created! Welcome!');
            navigate({ to: '/home' });
          } else {
            toast.success('Account created! Check your email to confirm.');
          }
        }
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

  const uploadAvatar = async (userId: string) => {
    if (!avatarFile) return;
    const ext = avatarFile.name.split('.').pop();
    const path = `${userId}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true });
    if (uploadError) return;
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    await supabase.from('profiles').update({ avatar_url: `${publicUrl}?t=${Date.now()}` }).eq('user_id', userId);
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

        {isSignUp && (
          <div className="flex gap-3 mb-6">
            <button
              type="button"
              onClick={() => setSignUpRole('user')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-semibold transition-all ${
                signUpRole === 'user' ? 'neu-pressed text-primary' : 'neu-btn text-muted-foreground'
              }`}
            >
              <User size={16} />
              User
            </button>
            <button
              type="button"
              onClick={() => setSignUpRole('admin')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-semibold transition-all ${
                signUpRole === 'admin' ? 'neu-pressed text-church-gold' : 'neu-btn text-muted-foreground'
              }`}
            >
              <Shield size={16} />
              Admin
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <>
              {/* Avatar upload */}
              <div className="flex justify-center mb-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-20 h-20 rounded-full neu-convex flex items-center justify-center overflow-hidden"
                  >
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <Camera size={24} className="text-muted-foreground" />
                    )}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
                  <span className="text-[11px] text-muted-foreground block text-center mt-1">Profile Photo</span>
                </div>
              </div>

              <NeuInput
                label="Full Name"
                placeholder="John Doe"
                value={name}
                onChange={e => setName(e.target.value)}
                autoComplete="name"
              />

              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground pl-1">Date of Birth</label>
                <input
                  type="date"
                  value={dob}
                  onChange={e => setDob(e.target.value)}
                  className="w-full px-4 py-3.5 neu-input text-foreground text-[15px] focus:outline-none"
                />
              </div>
            </>
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

          {isSignUp && signUpRole === 'admin' && (
            <NeuInput
              label="Admin Secret Key"
              type="password"
              placeholder="Enter admin key..."
              value={adminKey}
              onChange={e => setAdminKey(e.target.value)}
            />
          )}

          <div className="pt-2">
            <NeuButton type="submit" variant="primary" size="lg" isLoading={loading}>
              {isSignUp ? (signUpRole === 'admin' ? 'Create Admin Account' : 'Create Account') : 'Sign In'}
            </NeuButton>
          </div>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => { setIsSignUp(!isSignUp); setSignUpRole('user'); setAdminKey(''); setAvatarFile(null); setAvatarPreview(null); setDob(''); }}
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

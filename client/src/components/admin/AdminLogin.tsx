import { useState } from 'react';
import { signInWithEmail } from '@/services/authService';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { useToast } from '@/hooks/use-toast';

const AdminLogin = () => {
  const [email, setEmail] = useState('rmaru2889@gmail.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async () => {
    try {
      setLoading(true);
      const user = await signInWithEmail(email, password);
      console.log('Successfully logged in with UID:', user.uid);
      
      toast({
        title: 'Login Successful',
        description: `Logged in with UID: ${user.uid}`,
      });
    } catch (error: any) {
      console.error('Error logging in:', error);
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg max-w-md mx-auto mt-8">
      <h2 className="text-xl font-bold mb-4">Admin Login Test</h2>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password to try"
            disabled={loading}
          />
        </div>
        
        <Button
          onClick={handleLogin}
          disabled={loading || !password}
          className="w-full"
        >
          {loading ? 'Logging in...' : 'Test Login'}
        </Button>
      </div>
    </div>
  );
};

export default AdminLogin;
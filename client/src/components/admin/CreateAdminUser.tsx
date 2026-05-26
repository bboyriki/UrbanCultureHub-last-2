import { useState } from 'react';
import { signUpWithEmail } from '@/services/authService';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { useToast } from '@/hooks/use-toast';

const CreateAdminUser = () => {
  const [email, setEmail] = useState('rmaru2889@gmail.com');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleCreateUser = async () => {
    try {
      setLoading(true);
      const user = await signUpWithEmail(email, password, 'Admin', 'admin');
      console.log('User created in Firebase Auth with UID:', user.uid);
      
      toast({
        title: 'Admin User Created',
        description: `Created Firebase Auth user with UID: ${user.uid}`,
      });
    } catch (error: any) {
      console.error('Error creating Firebase user:', error);
      toast({
        variant: 'destructive',
        title: 'Error Creating User',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg max-w-md mx-auto mt-8">
      <h2 className="text-xl font-bold mb-4">Create Firebase Admin User</h2>
      
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
            disabled={loading}
          />
        </div>
        
        <Button
          onClick={handleCreateUser}
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Creating...' : 'Create Admin User in Firebase'}
        </Button>
      </div>
    </div>
  );
};

export default CreateAdminUser;
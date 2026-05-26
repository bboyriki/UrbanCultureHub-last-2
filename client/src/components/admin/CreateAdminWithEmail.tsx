import { useState } from 'react';
import { signUpWithEmail } from '@/services/authService';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

const CreateAdminWithEmail = () => {
  const [email, setEmail] = useState('oudaialmouti@gmail.com');
  const [password, setPassword] = useState('1261996riki');
  const [displayName, setDisplayName] = useState('Oudai Admin');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleCreateAdmin = async () => {
    try {
      setLoading(true);
      
      // Step 1: Create Firebase user
      const userCredential = await signUpWithEmail(email, password, displayName, 'admin');
      const firebaseUid = userCredential.uid;
      console.log('Successfully created Firebase user with UID:', firebaseUid);
      
      // Step 2: Create user record in our database
      const userData = {
        email,
        displayName,
        role: 'admin', // Make sure to set role as admin
        firebaseUid,
        isVerified: true, 
        isApproved: true
      };
      
      const response = await apiRequest('POST', '/api/users', userData);
      
      if (response.ok) {
        const user = await response.json();
        
        toast({
          title: 'Admin Created Successfully',
          description: `Created admin account for ${email} with ID: ${user.id}`,
        });
      } else {
        const errorData = await response.json();
        throw new Error(`Failed to create admin in database: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error creating admin user:', error);
      toast({
        variant: 'destructive',
        title: 'Admin Creation Failed',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg max-w-md mx-auto mt-8">
      <h2 className="text-xl font-bold mb-4">Create Admin User</h2>
      
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
        
        <div className="space-y-2">
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={loading}
          />
        </div>
        
        <Button
          onClick={handleCreateAdmin}
          disabled={loading || !email || !password || !displayName}
          className="w-full"
        >
          {loading ? 'Creating...' : 'Create Admin User'}
        </Button>
      </div>
    </div>
  );
};

export default CreateAdminWithEmail;
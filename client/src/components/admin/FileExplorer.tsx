import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  ChevronDown, 
  ChevronRight, 
  FileIcon, 
  Folder, 
  FolderOpen, 
  RefreshCw, 
  Search,
  FileCode,
  FileJson,
  FileText,
  FileImage,
  FileCheck,
  ServerIcon,
  LayoutGrid,
  Database,
  Settings,
  Globe
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  extension?: string;
}

interface FileExplorerProps {
  onSelectFile: (filePath: string) => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ onSelectFile }) => {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/client', '/server', '/shared']));
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'folders' | 'categories' | 'all'>('all');
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/files');
      
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }
      
      const data = await response.json();
      setFiles(data);
      
      // Auto-expand important folders
      const importantFolders = [
        '/client', 
        '/server', 
        '/shared',
        '/client/src',
        '/client/src/components',
        '/server/routes',
        '/shared/schema'
      ];
      
      setExpandedFolders(new Set(importantFolders));
    } catch (error) {
      console.error('Error fetching files:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch project files. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFolderToggle = (path: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const handleFileClick = async (node: FileNode) => {
    if (node.type === 'file') {
      try {
        setSelectedFile(node.path);
        // Just notify parent component about the selected file path
        // Parent will handle fetching the content
        onSelectFile(node.path);
      } catch (error) {
        console.error('Error selecting file:', error);
      }
    }
  };

  const getCategory = (node: FileNode): string => {
    if (node.type === 'directory') return 'folder';
    
    if (!node.extension) return 'other';
    
    const ext = node.extension.toLowerCase();
    
    // Frontend files
    if (['js', 'jsx', 'ts', 'tsx', 'css', 'html', 'scss', 'less'].includes(ext)) {
      return 'frontend';
    }
    
    // Backend files
    if (['js', 'ts'].includes(ext) && node.path.startsWith('/server')) {
      return 'backend';
    }
    
    // Config files
    if (['json', 'config.js', 'config.ts', '.env', '.gitignore', '.eslintrc'].some(configExt => 
      node.name.endsWith(configExt) || node.name === configExt
    )) {
      return 'config';
    }
    
    // Data files
    if (['json', 'csv', 'xml'].includes(ext)) {
      return 'data';
    }
    
    // Documentation
    if (['md', 'txt', 'pdf'].includes(ext)) {
      return 'docs';
    }
    
    // Images
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
      return 'image';
    }
    
    // Schema/database related
    if (node.path.includes('/schema') || node.path.includes('database') || ext === 'sql') {
      return 'database';
    }
    
    return 'other';
  };

  const getFileIcon = (node: FileNode) => {
    if (node.type === 'directory') {
      return expandedFolders.has(node.path) ? 
        <FolderOpen className="h-4 w-4 mr-2 text-amber-500" /> : 
        <Folder className="h-4 w-4 mr-2 text-amber-500" />;
    }
    
    if (!node.extension) return <FileIcon className="h-4 w-4 mr-2 text-blue-500" />;
    
    const ext = node.extension.toLowerCase();
    
    // Return appropriate icon based on file extension
    if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) {
      return <FileCode className="h-4 w-4 mr-2 text-blue-500" />;
    }
    
    if (['json', 'config.js', 'config.ts'].includes(ext) || node.name.includes('config')) {
      return <FileJson className="h-4 w-4 mr-2 text-purple-500" />;
    }
    
    if (['md', 'txt'].includes(ext)) {
      return <FileText className="h-4 w-4 mr-2 text-green-500" />;
    }
    
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
      return <FileImage className="h-4 w-4 mr-2 text-pink-500" />;
    }
    
    if (['html', 'css', 'scss', 'less'].includes(ext)) {
      return <Globe className="h-4 w-4 mr-2 text-orange-500" />;
    }
    
    if (node.path.includes('/schema') || node.path.includes('database') || ext === 'sql') {
      return <Database className="h-4 w-4 mr-2 text-indigo-500" />;
    }
    
    if (['test.js', 'test.ts', 'spec.js', 'spec.ts'].some(testExt => node.name.includes(testExt))) {
      return <FileCheck className="h-4 w-4 mr-2 text-green-600" />;
    }
    
    // Default icon
    return <FileIcon className="h-4 w-4 mr-2 text-blue-500" />;
  };

  const getLanguageBadge = (extension?: string) => {
    if (!extension) return null;
    
    const extensionMap: Record<string, { label: string, color: string }> = {
      'js': { label: 'JavaScript', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      'ts': { label: 'TypeScript', color: 'bg-blue-100 text-blue-800 border-blue-200' },
      'tsx': { label: 'React TSX', color: 'bg-blue-100 text-blue-800 border-blue-200' },
      'jsx': { label: 'React JSX', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
      'css': { label: 'CSS', color: 'bg-pink-100 text-pink-800 border-pink-200' },
      'html': { label: 'HTML', color: 'bg-orange-100 text-orange-800 border-orange-200' },
      'json': { label: 'JSON', color: 'bg-gray-100 text-gray-800 border-gray-200' },
      'md': { label: 'Markdown', color: 'bg-green-100 text-green-800 border-green-200' },
      'sql': { label: 'SQL', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
      'env': { label: 'ENV', color: 'bg-purple-100 text-purple-800 border-purple-200' },
      'svg': { label: 'SVG', color: 'bg-pink-100 text-pink-800 border-pink-200' }
    };
    
    const ext = extension.toLowerCase();
    const langInfo = extensionMap[ext] || { label: ext.toUpperCase(), color: 'bg-gray-100 text-gray-800 border-gray-200' };
    
    return (
      <Badge variant="outline" className={`ml-2 text-[10px] px-1 ${langInfo.color}`}>
        {langInfo.label}
      </Badge>
    );
  };

  const filterFilesByCategory = (nodes: FileNode[], category: string | null): FileNode[] => {
    if (!category) return nodes;
    
    return nodes.filter(node => {
      if (node.type === 'directory') {
        // For directories, check if any children match the category
        const filteredChildren = node.children ? filterFilesByCategory(node.children, category) : [];
        return filteredChildren.length > 0;
      }
      
      return getCategory(node) === category;
    }).map(node => {
      if (node.type === 'directory' && node.children) {
        return {
          ...node,
          children: filterFilesByCategory(node.children, category)
        };
      }
      return node;
    });
  };

  const renderFileTree = (nodes: FileNode[], level = 0) => {
    if (!nodes || nodes.length === 0) return null;

    // Apply category filter if needed
    const filteredNodes = filter ? filterFilesByCategory(nodes, filter) : nodes;

    return filteredNodes
      .filter(node => {
        if (!searchQuery) return true;
        return node.name.toLowerCase().includes(searchQuery.toLowerCase());
      })
      .map(node => {
        const isExpanded = expandedFolders.has(node.path);
        const isSelected = selectedFile === node.path;
        
        return (
          <div key={node.path} style={{ paddingLeft: `${level * 16}px` }}>
            <div 
              className={`flex items-center py-1 px-2 rounded-md cursor-pointer hover:bg-muted transition-colors ${
                isSelected ? 'bg-muted border-l-2 border-primary' : ''
              }`}
              onClick={() => node.type === 'directory' ? handleFolderToggle(node.path) : handleFileClick(node)}
            >
              <div className="mr-1">
                {node.type === 'directory' ? (
                  isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                ) : <span className="w-4"></span>}
              </div>
              {getFileIcon(node)}
              <span className="text-sm truncate">{node.name}</span>
              {node.type === 'file' && node.extension && getLanguageBadge(node.extension)}
            </div>
            
            {node.type === 'directory' && isExpanded && node.children && renderFileTree(node.children, level + 1)}
          </div>
        );
      });
  };

  const renderCategoryButtons = () => {
    const categories = [
      { id: null, label: 'All', icon: <LayoutGrid className="h-4 w-4" /> },
      { id: 'frontend', label: 'Frontend', icon: <Globe className="h-4 w-4" /> },
      { id: 'backend', label: 'Backend', icon: <ServerIcon className="h-4 w-4" /> },
      { id: 'database', label: 'Database', icon: <Database className="h-4 w-4" /> },
      { id: 'config', label: 'Config', icon: <Settings className="h-4 w-4" /> }
    ];
    
    return (
      <div className="flex flex-wrap gap-1 mb-2">
        {categories.map(category => (
          <TooltipProvider key={category.id || 'all'}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant={filter === category.id ? "default" : "outline"}
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setFilter(category.id)}
                >
                  {category.icon}
                  <span className="ml-1 text-xs">{category.label}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Show {category.label} files</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    );
  };

  return (
    <div className="border rounded-md h-full flex flex-col">
      <div className="p-3 border-b flex items-center justify-between">
        <h3 className="font-medium flex items-center">
          <FileIcon className="h-4 w-4 mr-2" />
          Project Explorer
        </h3>
        <Button size="icon" variant="ghost" onClick={fetchFiles} title="Refresh files">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="p-3 border-b">
        <div className="relative mb-3">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <Tabs defaultValue="all" className="w-full" onValueChange={(value) => setViewMode(value as any)}>
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="all" className="text-xs">All Files</TabsTrigger>
            <TabsTrigger value="categories" className="text-xs">Categories</TabsTrigger>
            <TabsTrigger value="folders" className="text-xs">Folders</TabsTrigger>
          </TabsList>
        </Tabs>
        
        {viewMode === 'categories' && renderCategoryButtons()}
      </div>
      
      <ScrollArea className="flex-grow">
        <div className="p-2">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : (
            renderFileTree(files)
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
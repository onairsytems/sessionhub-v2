import React, { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface User {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'super_admin';
  fullName?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    checkSuperAdminAccess();
    loadUsers();
  }, []);

  const checkSuperAdminAccess = async () => {
    const result = await window.electron.invoke('admin:check-super-access');
    setIsSuperAdmin(result.success && result.isSuperAdmin);
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const result = await window.electron.invoke('admin:get-all-users');
      if (result.success) {
        setUsers(result.users);
      } else {
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: 'user' | 'admin' | 'super_admin') => {
    if (!isSuperAdmin) {
      alert('Only super administrators can change user roles');
      return;
    }

    const user = users.find(u => u.id === userId);
    if (!user) return;

    if (!confirm(`Change ${user.email} role from ${user.role} to ${newRole}?`)) {
      return;
    }

    try {
      const result = await window.electron.invoke('admin:update-user-role', userId, newRole);
      if (result.success) {
        await loadUsers();
      } else {
        alert(`Failed to update role: ${result.error}`);
      }
    } catch (error) {
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const action = currentStatus ? 'suspend' : 'activate';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} user ${user.email}?`)) {
      return;
    }

    try {
      const endpoint = currentStatus ? 'admin:suspend-user' : 'admin:activate-user';
      const result = await window.electron.invoke(endpoint, userId);
      if (result.success) {
        await loadUsers();
      } else {
        alert(`Failed to ${action} user: ${result.error}`);
      }
    } catch (error) {
    }
  };

  const batchOperation = async (operation: 'suspend' | 'activate') => {
    if (selectedUsers.size === 0) {
      alert('No users selected');
      return;
    }

    if (!confirm(`${operation.charAt(0).toUpperCase() + operation.slice(1)} ${selectedUsers.size} users?`)) {
      return;
    }

    try {
      const result = await window.electron.invoke('admin:batch-user-operation', operation, Array.from(selectedUsers));
      if (result.success) {
        setSelectedUsers(new Set());
        await loadUsers();
      } else {
        alert(`Batch operation failed: ${result.error}`);
      }
    } catch (error) {
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'admin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          />
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          >
            <option value="all">All Roles</option>
            <option value="user">Users</option>
            <option value="admin">Admins</option>
            <option value="super_admin">Super Admins</option>
          </select>
          <div className="flex gap-2">
            <Button
              onClick={() => batchOperation('suspend')}
              variant="secondary"
              disabled={selectedUsers.size === 0}
            >
              Suspend Selected
            </Button>
            <Button
              onClick={() => batchOperation('activate')}
              variant="secondary"
              disabled={selectedUsers.size === 0}
            >
              Activate Selected
            </Button>
          </div>
        </div>
      </Card>

      {/* User List */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
                      } else {
                        setSelectedUsers(new Set());
                      }
                    }}
                    checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(user.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedUsers);
                        if (e.target.checked) {
                          newSelected.add(user.id);
                        } else {
                          newSelected.delete(user.id);
                        }
                        setSelectedUsers(newSelected);
                      }}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.email}
                      </div>
                      {user.fullName && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {user.fullName}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                      {user.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.isActive
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {user.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex space-x-2">
                      {isSuperAdmin && (
                        <select
                          value={user.role}
                          onChange={(e) => updateUserRole(user.id, e.target.value as any)}
                          className="text-xs px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                          <option value="super_admin">Super Admin</option>
                        </select>
                      )}
                      <Button
                        onClick={() => toggleUserStatus(user.id, user.isActive)}
                        variant="ghost"
                        size="sm"
                      >
                        {user.isActive ? 'Suspend' : 'Activate'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Summary */}
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Showing {filteredUsers.length} of {users.length} users
      </div>
    </div>
  );
};
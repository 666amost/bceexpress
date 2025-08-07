"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabaseClient } from '@/lib/auth';
import { fetchManifestFromBranch } from '@/lib/branch-sync';
import { validateBranchAccess, isValidUserRole } from '@/types/branch';
import type { UserRole } from '@/types/branch';
import type { User } from '@supabase/supabase-js';

interface UserData {
  role: string;
  origin_branch: string | null;
}

interface DebugInfo {
  userAuth: User | null;
  userRole: UserRole | null;
  branchOrigin: string | null;
  databaseConnection: boolean;
  branchAPIConnection: boolean;
  permissions: {
    hasValidRole: boolean;
    hasBranchAccess: boolean;
    canAccessCabang: boolean;
  };
  errors: string[];
}

export default function BranchDebugger() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    userAuth: null,
    userRole: null,
    branchOrigin: null,
    databaseConnection: false,
    branchAPIConnection: false,
    permissions: {
      hasValidRole: false,
      hasBranchAccess: false,
      canAccessCabang: false,
    },
    errors: []
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const runDiagnostics = async (): Promise<void> => {
    setIsLoading(true);
    const errors: string[] = [];
    let userAuth: User | null = null;
    let userRole: UserRole | null = null;
    let branchOrigin: string | null = null;
    let databaseConnection = false;
    let branchAPIConnection = false;

    try {
      // 1. Check user authentication
      const { data: authData, error: authError } = await supabaseClient.auth.getUser();
      if (authError) {
        errors.push(`Auth Error: ${authError.message}`);
      } else {
        userAuth = authData.user;
      }

      // 2. Check database connection and user data
      if (userAuth) {
        try {
          const { data: userData, error: dbError } = await supabaseClient
            .from('users')
            .select('role, origin_branch')
            .eq('id', userAuth.id)
            .single();

          if (dbError) {
            errors.push(`Database Error: ${dbError.message}`);
          } else if (userData) {
            databaseConnection = true;
            const role = userData.role as string;
            if (isValidUserRole(role)) {
              userRole = role;
              branchOrigin = userData.origin_branch;
            } else {
              errors.push(`Invalid user role: ${role}`);
            }
          } else {
            errors.push('No user data found in database');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
          errors.push(`Database connection failed: ${errorMessage}`);
        }
      }

      // 3. Test branch API connection
      try {
        const testResult = await fetchManifestFromBranch('TEST123');
        branchAPIConnection = true; // If no exception, API is reachable
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown API error';
        errors.push(`Branch API Error: ${errorMessage}`);
      }

      // 4. Check permissions
      const permissions = {
        hasValidRole: userRole !== null,
        hasBranchAccess: validateBranchAccess(userRole, branchOrigin),
        canAccessCabang: userRole === 'cabang' // Sekarang cabang bisa akses tanpa batasan origin_branch
      };

      setDebugInfo({
        userAuth,
        userRole,
        branchOrigin,
        databaseConnection,
        branchAPIConnection,
        permissions,
        errors
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      errors.push(`General Error: ${errorMessage}`);
      setDebugInfo(prev => ({ ...prev, errors }));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const StatusBadge = ({ status, label }: { status: boolean; label: string }) => (
    <Badge variant={status ? "default" : "destructive"} className="mr-2 mb-2">
      {status ? "✅" : "❌"} {label}
    </Badge>
  );

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Branch System Debugger
            <Button onClick={runDiagnostics} disabled={isLoading}>
              {isLoading ? "Running..." : "Re-run Diagnostics"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Authentication Status */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Authentication Status</h3>
            <StatusBadge status={!!debugInfo.userAuth} label="User Authenticated" />
            {debugInfo.userAuth && (
              <div className="mt-2 p-2 bg-gray-50 rounded">
                <p><strong>Email:</strong> {debugInfo.userAuth.email}</p>
                <p><strong>ID:</strong> {debugInfo.userAuth.id}</p>
              </div>
            )}
          </div>

          {/* Database Connection */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Database Connection</h3>
            <StatusBadge status={debugInfo.databaseConnection} label="Database Connected" />
            <StatusBadge status={!!debugInfo.userRole} label="User Role Retrieved" />
            {debugInfo.userRole && (
              <div className="mt-2 p-2 bg-gray-50 rounded">
                <p><strong>Role:</strong> {debugInfo.userRole}</p>
                <p><strong>Branch Origin:</strong> {debugInfo.branchOrigin || 'Not set'}</p>
              </div>
            )}
          </div>

          {/* Branch API Connection */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Branch API Connection</h3>
            <StatusBadge status={debugInfo.branchAPIConnection} label="Branch API Reachable" />
          </div>

          {/* Permissions */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Permissions</h3>
            <StatusBadge status={debugInfo.permissions.hasValidRole} label="Valid Role" />
            <StatusBadge status={debugInfo.permissions.hasBranchAccess} label="Branch Access" />
            <StatusBadge status={debugInfo.permissions.canAccessCabang} label="Cabang Access" />
          </div>

          {/* Errors */}
          {debugInfo.errors.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Errors</h3>
              {debugInfo.errors.map((error, index) => (
                <Alert key={index} variant="destructive" className="mb-2">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          {/* Recommendations */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Recommendations</h3>
            <div className="space-y-2">
              {!debugInfo.userAuth && (
                <Alert>
                  <AlertDescription>
                    User is not authenticated. Please login through /branch/login
                  </AlertDescription>
                </Alert>
              )}
              {!debugInfo.databaseConnection && (
                <Alert>
                  <AlertDescription>
                    Database connection failed. Check Supabase configuration and network connectivity.
                  </AlertDescription>
                </Alert>
              )}
              {!debugInfo.permissions.hasValidRole && (
                <Alert>
                  <AlertDescription>
                    Invalid or missing user role. User role must be one of: admin, branch, cabang, couriers
                  </AlertDescription>
                </Alert>
              )}
              {!debugInfo.permissions.hasBranchAccess && debugInfo.userRole === 'cabang' && (
                <Alert>
                  <AlertDescription>
                    Cabang user must have origin_branch set to 'bangka' or 'tanjung_pandan'
                  </AlertDescription>
                </Alert>
              )}
              {!debugInfo.branchAPIConnection && (
                <Alert>
                  <AlertDescription>
                    Branch API is not reachable. Check API endpoint and network connectivity.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

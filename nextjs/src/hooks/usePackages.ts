import { useEffect, useState } from 'react';
import { createSPAClient } from '@/lib/supabase/client';
import type { CreditPackage } from '@/types/database.types';

export function usePackages() {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPackages();
  }, []);

  async function loadPackages() {
    try {
      const supabase = createSPAClient();
      const { data, error: fetchError } = await supabase
        .from('credit_packages')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (fetchError) throw fetchError;

      setPackages(data || []);
      setError(null);
    } catch (err) {
      console.error('Error loading packages:', err);
      setError('Error al cargar paquetes');
    } finally {
      setLoading(false);
    }
  }

  // Helpers
  const fixedPackages = packages.filter(p => p.package_type === 'fixed');
  const customPackage = packages.find(p => p.package_type === 'custom');
  const popularPackage = packages.find(p => p.is_popular);

  return {
    packages,
    fixedPackages,
    customPackage,
    popularPackage,
    loading,
    error,
    refresh: loadPackages
  };
}
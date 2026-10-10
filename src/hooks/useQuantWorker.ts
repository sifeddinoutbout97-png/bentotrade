import { useEffect, useRef, useCallback, useState } from 'react';
import { 
  QuantWorkerTaskType, 
  QuantWorkerRequest, 
  QuantWorkerResponse 
} from '../types';

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  type: QuantWorkerTaskType;
}

export function useQuantWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRequestsRef = useRef<Map<string, PendingRequest>>(new Map());
  const [isReady, setIsReady] = useState(false);
  const [activeJobs, setActiveJobs] = useState(0);

  // Initialize native Vite web worker
  useEffect(() => {
    let worker: Worker | null = null;

    try {
      worker = new Worker(
        new URL('../workers/quantEngine.worker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = (event: MessageEvent<QuantWorkerResponse>) => {
        const { id, success, result, error } = event.data;
        const pending = pendingRequestsRef.current.get(id);

        if (pending) {
          pendingRequestsRef.current.delete(id);
          setActiveJobs(pendingRequestsRef.current.size);

          if (success) {
            pending.resolve(result);
          } else {
            pending.reject(new Error(error || 'Worker execution failed'));
          }
        }
      };

      worker.onerror = (err) => {
        console.error('QuantEngine Worker error:', err);
        // Reject all outstanding requests
        pendingRequestsRef.current.forEach((pending) => {
          pending.reject(new Error('Quant worker encountered a fatal crash'));
        });
        pendingRequestsRef.current.clear();
        setActiveJobs(0);
      };

      workerRef.current = worker;
      setIsReady(true);
    } catch (err) {
      console.error('Failed to instantiate QuantWorker:', err);
    }

    // Clean up worker on component unmount
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      pendingRequestsRef.current.forEach((pending) => {
        pending.reject(new Error('QuantWorker terminated on component unmount'));
      });
      pendingRequestsRef.current.clear();
      setIsReady(false);
      setActiveJobs(0);
    };
  }, []);

  /**
   * Dispatches a computation to the Web Worker and wraps response in a Promise
   */
  const runCalculation = useCallback(<T = any>(
    type: QuantWorkerTaskType, 
    payload: any
  ): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const worker = workerRef.current;
      if (!worker) {
        reject(new Error('QuantEngine Worker is not initialized or has been terminated'));
        return;
      }

      const id = `${type}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      pendingRequestsRef.current.set(id, { resolve, reject, type });
      setActiveJobs(pendingRequestsRef.current.size);

      const request: QuantWorkerRequest = {
        id,
        type,
        payload
      };

      worker.postMessage(request);
    });
  }, []);

  return {
    isReady,
    activeJobs,
    runCalculation
  };
}

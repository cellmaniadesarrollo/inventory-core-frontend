import { Injectable, signal } from '@angular/core';
import { Observable, Subject, filter, map } from 'rxjs';
import { io, Socket } from 'socket.io-client';

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private socket?: Socket;
  private readonly events$ = new Subject<{ event: string; data: any }>();
  readonly connected = signal(false);

  connect(url: string, token: string) {
    this.disconnect();
    this.socket = io(url, { auth: { token }, transports: ['websocket'] });
    this.socket.on('connect', () => this.connected.set(true));
    this.socket.on('disconnect', () => this.connected.set(false));
    this.socket.onAny((event, data) => this.events$.next({ event, data }));
  }

  disconnect() {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = undefined;
    this.connected.set(false);
  }

  on<T>(event: string): Observable<T> {
    return this.events$.pipe(
      filter((e) => e.event === event),
      map((e) => e.data as T),
    );
  }
}
export interface Session {
  id: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  metadata?: Record<string, any>;
}

export class SessionService {
  private sessions: Session[] = [];

  createSession(userId: string): Session {
    const session: Session = {
      id: Date.now().toString(),
      userId,
      startTime: new Date()
    };
    this.sessions.push(session);
    return session;
  }

  getSessions(): Session[] {
    return this.sessions;
  }

  getSessionById(id: string): Session | undefined {
    return this.sessions.find(s => s.id === id);
  }
}

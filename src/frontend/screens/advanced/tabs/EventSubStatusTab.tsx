import React from 'react';
import { EventSubDashboard } from './EventSubDashboard';

interface EventSubStatusTabProps {
  userId?: string;
  accessToken?: string;
  clientId?: string;
  broadcasterId?: string;
}

export const EventSubStatusTab: React.FC<EventSubStatusTabProps> = ({
  userId = '',
  accessToken = '',
  clientId = '',
  broadcasterId = ''
}) => {
  return (
    <EventSubDashboard
      userId={userId}
      accessToken={accessToken}
      clientId={clientId}
      broadcasterId={broadcasterId}
    />
  );
};

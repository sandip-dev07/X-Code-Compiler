"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pusherClient } from "@/lib/pusher";

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [pusherState, setPusherState] = useState(pusherClient.connection.state);

  const addLog = (message: string) => {
    setLogs((prev) => [message, ...prev].slice(0, 20));
  };

  const testPusherConnection = () => {
    addLog(`Current Pusher state: ${pusherClient.connection.state}`);

    pusherClient.connection.bind("state_change", (states: any) => {
      addLog(`Pusher state changed: ${states.current}`);
      setPusherState(states.current);
    });

    // Try to connect if disconnected
    if (pusherClient.connection.state === "disconnected") {
      addLog("Attempting to connect to Pusher...");
      pusherClient.connect();
    }
  };

  const testWebRTC = async () => {
    try {
      addLog("Testing WebRTC capabilities...");

      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        addLog("❌ getUserMedia not supported");
        return;
      }

      addLog("✅ getUserMedia supported");

      // Check if RTCPeerConnection is supported
      if (!window.RTCPeerConnection) {
        addLog("❌ RTCPeerConnection not supported");
        return;
      }

      addLog("✅ RTCPeerConnection supported");

      // Try to access the microphone
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        addLog("✅ Microphone access granted");

        // Stop the stream
        stream.getTracks().forEach((track) => track.stop());
      } catch (error) {
        addLog(`❌ Microphone access denied: ${error}`);
      }

      // Test STUN server connectivity
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addLog(
            `✅ ICE candidate found: ${event.candidate.candidate.split(" ")[7]}`
          );
        }
      };

      pc.onicegatheringstatechange = () => {
        addLog(`ICE gathering state: ${pc.iceGatheringState}`);
        if (pc.iceGatheringState === "complete") {
          pc.close();
        }
      };

      // Create a data channel to trigger ICE gathering
      pc.createDataChannel("test");

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      addLog("WebRTC test initiated, gathering ICE candidates...");
    } catch (error) {
      addLog(`❌ WebRTC test failed: ${error}`);
    }
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-50 bg-black/80 text-white"
        onClick={() => setIsOpen(true)}
      >
        Debug
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-80 max-h-96 overflow-auto bg-black/90 text-white border-gray-700">
      <CardHeader className="p-3">
        <CardTitle className="text-sm flex justify-between items-center">
          <span>Debug Panel</span>
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
            ×
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        <div className="flex space-x-2">
          <Button size="sm" variant="outline" onClick={testPusherConnection}>
            Test Pusher
          </Button>
          <Button size="sm" variant="outline" onClick={testWebRTC}>
            Test WebRTC
          </Button>
        </div>

        <div className="text-xs">
          <p>
            Pusher State:{" "}
            <span
              className={
                pusherState === "connected"
                  ? "text-green-500"
                  : pusherState === "connecting"
                    ? "text-yellow-500"
                    : "text-red-500"
              }
            >
              {pusherState}
            </span>
          </p>
        </div>

        <div className="text-xs space-y-1 max-h-40 overflow-y-auto">
          {logs.map((log, i) => (
            <p key={i} className="border-l-2 border-gray-700 pl-2">
              {log}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

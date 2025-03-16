"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { pusherClient } from "@/lib/pusher";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

interface VoiceChatProps {
  sessionId: string;
  clientId: string;
}

type PeerConnection = {
  connection: RTCPeerConnection;
  audio: HTMLAudioElement;
};

type PeerConnections = {
  [key: string]: PeerConnection;
};

export function VoiceChat({ sessionId, clientId }: VoiceChatProps) {
  const [isMuted, setIsMuted] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [activeUsers, setActiveUsers] = useState<string[]>([]);
  const [talkingUsers, setTalkingUsers] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<PeerConnections>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const channelRef = useRef<any>(null);
  const audioElementsRef = useRef<HTMLDivElement | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "error"
  >("connecting");

  // Initialize audio context and voice activity detection
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        audioContextRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        const bufferLength = analyserRef.current.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);
      } catch (error) {
        console.error("Error initializing audio context:", error);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      audioContextRef.current?.close();
    };
  }, []);

  // Set up Pusher channel for signaling
  useEffect(() => {
    if (!sessionId) return;

    // Use private channel for voice communication
    const channelName = `private-voice-${sessionId}`;

    // Subscribe to the channel
    try {
      const channel = pusherClient.subscribe(channelName);
      channelRef.current = channel;

      // Wait for subscription to succeed
      channel.bind("pusher:subscription_succeeded", () => {
        console.log("Successfully subscribed to voice channel");
        setConnectionStatus("connected");

        // Announce presence when joining
        announcePresence("join");
      });

      channel.bind("pusher:subscription_error", (error: any) => {
        console.error("Error subscribing to voice channel:", error);
        setConnectionStatus("error");
        toast({
          title: "Voice Chat Error",
          description: "Could not connect to voice chat. Please try again.",
          variant: "destructive",
        });
      });

      // Handle client events for WebRTC signaling
      channel.bind("client-signal", (data: any) => {
        if (data.targetClientId === clientId) {
          const { sourceClientId, signal } = data;

          console.log(
            "Received signal:",
            signal.type || "ICE candidate",
            "from",
            sourceClientId
          );

          if (signal.type === "offer") {
            handleOffer(sourceClientId, signal);
          } else if (signal.type === "answer") {
            handleAnswer(sourceClientId, signal);
          } else if (signal.candidate) {
            handleIceCandidate(sourceClientId, signal);
          } else if (signal.type === "speaking") {
            // Update talking users
            if (signal.speaking) {
              setTalkingUsers((prev) => {
                const newSet = new Set(prev);
                newSet.add(sourceClientId);
                return newSet;
              });
            } else {
              setTalkingUsers((prev) => {
                const newSet = new Set(prev);
                newSet.delete(sourceClientId);
                return newSet;
              });
            }
          } else if (signal.type === "mute") {
            // Handle peer mute event if needed
          }
        }
      });

      // Handle user join/leave events
      channel.bind("voice-user-joined", (data: { clientId: string }) => {
        console.log("User joined voice chat:", data.clientId);
        if (data.clientId !== clientId) {
          setActiveUsers((prev) => {
            if (!prev.includes(data.clientId)) {
              return [...prev, data.clientId];
            }
            return prev;
          });

          // Create peer connection for new user
          if (!peerConnectionsRef.current[data.clientId]) {
            createPeerConnection(data.clientId);

            // If we're not muted, initiate a call to the new user
            if (!isMuted && localStreamRef.current) {
              setTimeout(() => {
                const pc =
                  peerConnectionsRef.current[data.clientId]?.connection;
                if (pc) {
                  createAndSendOffer(data.clientId, pc);
                }
              }, 1000); // Give a bit of time for the peer connection to initialize
            }
          }
        }
      });

      channel.bind("voice-user-left", (data: { clientId: string }) => {
        console.log("User left voice chat:", data.clientId);
        if (data.clientId !== clientId) {
          setActiveUsers((prev) => prev.filter((id) => id !== data.clientId));
          closePeerConnection(data.clientId);
        }
      });
    } catch (error) {
      console.error("Error setting up Pusher channel:", error);
    }

    // Clean up on unmount
    return () => {
      // Announce departure
      announcePresence("leave");

      // Close all peer connections
      Object.keys(peerConnectionsRef.current).forEach((peerId) => {
        closePeerConnection(peerId);
      });

      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }

      // Unsubscribe from Pusher channel
      try {
        pusherClient.unsubscribe(channelName);
        channelRef.current = null;
      } catch (error) {
        console.error("Error unsubscribing from Pusher channel:", error);
      }
    };
  }, [sessionId, clientId, toast]);

  // Announce presence to the server
  const announcePresence = async (action: "join" | "leave" | "heartbeat") => {
    if (!sessionId || !clientId) return;

    try {
      await fetch("/api/voice/presence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          clientId,
          action,
        }),
        keepalive: action === "leave",
      });
    } catch (error) {
      console.error(`Error announcing voice ${action}:`, error);
    }
  };

  // Initialize user's microphone when unmuted
  useEffect(() => {
    if (!isMuted) {
      initializeLocalStream();
    } else if (localStreamRef.current) {
      // Stop all tracks when muted
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;

      // Notify peers that we're muted
      Object.keys(peerConnectionsRef.current).forEach((peerId) => {
        sendSignal(peerId, { type: "mute" });
      });
    }
  }, [isMuted]);

  // Update audio elements when audio is enabled/disabled
  useEffect(() => {
    // Update muted state for all audio elements
    Object.values(peerConnectionsRef.current).forEach(({ audio }) => {
      audio.muted = !isAudioEnabled;
    });

    // Try to force play audio when enabling
    if (isAudioEnabled) {
      forcePlayAudio();
    }
  }, [isAudioEnabled]);

  // Initialize local audio stream
  const initializeLocalStream = async () => {
    try {
      console.log("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      console.log("Microphone access granted");
      localStreamRef.current = stream;

      // Set up voice activity detection
      if (
        audioContextRef.current &&
        analyserRef.current &&
        dataArrayRef.current
      ) {
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);

        const detectVoiceActivity = () => {
          if (!analyserRef.current || !dataArrayRef.current) return;

          analyserRef.current.getByteFrequencyData(dataArrayRef.current);

          // Calculate average frequency amplitude
          const average =
            dataArrayRef.current.reduce((sum, value) => sum + value, 0) /
            dataArrayRef.current.length;

          // If average is above threshold, user is speaking
          const isSpeaking = average > 20; // Adjust threshold as needed

          // Broadcast speaking status to other peers
          if (isSpeaking) {
            Object.keys(peerConnectionsRef.current).forEach((peerId) => {
              sendSignal(peerId, { type: "speaking", speaking: true });
            });
          }

          animationFrameRef.current =
            requestAnimationFrame(detectVoiceActivity);
        };

        detectVoiceActivity();
      }

      // Add tracks to all existing peer connections
      Object.keys(peerConnectionsRef.current).forEach((peerId) => {
        const pc = peerConnectionsRef.current[peerId].connection;

        // Remove any existing tracks
        const senders = pc.getSenders();
        senders.forEach((sender) => {
          if (sender.track?.kind === "audio") {
            pc.removeTrack(sender);
          }
        });

        // Add the new audio track
        stream.getAudioTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // Create and send offer after adding tracks
        createAndSendOffer(peerId, pc);
      });

      // If we have active users but no peer connections, create them
      if (activeUsers.length > 0) {
        activeUsers.forEach((userId) => {
          if (!peerConnectionsRef.current[userId]) {
            const peerData = createPeerConnection(userId);
            createAndSendOffer(userId, peerData.connection);
          }
        });
      }

      toast({
        title: "Microphone activated",
        description: "Others can now hear you speaking.",
      });
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast({
        title: "Microphone Error",
        description:
          "Could not access your microphone. Please check permissions.",
        variant: "destructive",
      });
      setIsMuted(true);
    }
  };

  // Create a new RTCPeerConnection
  const createPeerConnection = (peerId: string): PeerConnection => {
    console.log("Creating peer connection for:", peerId);

    // Check if we already have a connection for this peer
    if (peerConnectionsRef.current[peerId]) {
      console.log("Connection already exists for:", peerId);
      return peerConnectionsRef.current[peerId];
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        // Free TURN servers - replace with your own in production
        {
          urls: [
            "turn:global.turn.twilio.com:3478?transport=udp",
            "turn:global.turn.twilio.com:3478?transport=tcp",
            "turn:global.turn.twilio.com:443?transport=tcp",
          ],
          username:
            "f4b4035eaa76f4a55de5f4351567653ee4ff6fa97b50b6b334fcc1be9c27212d",
          credential: "w1WpauEsFYlymHFJevRPcGJ87xVMEFh96WfkOG9XgFw=",
        },
      ],
      iceCandidatePoolSize: 10,
    });

    // Create audio element for this peer
    const audio = new Audio();
    audio.autoplay = true;
    audio.controls = false; // Set to true for debugging
    audio.muted = !isAudioEnabled;
    audio.id = `audio-${peerId}`;

    // Store the audio element in the DOM
    if (audioElementsRef.current) {
      const audioContainer = document.createElement("div");
      audioContainer.id = `audio-container-${peerId}`;
      audioContainer.style.display = "none";
      audioContainer.appendChild(audio);
      audioElementsRef.current.appendChild(audioContainer);
    } else {
      // If the ref isn't available yet, create a hidden container
      const container = document.createElement("div");
      container.id = "audio-elements-container";
      container.style.display = "none";
      document.body.appendChild(container);

      const audioContainer = document.createElement("div");
      audioContainer.id = `audio-container-${peerId}`;
      audioContainer.appendChild(audio);
      container.appendChild(audioContainer);

      // Set the ref to this container
      if (!audioElementsRef.current) {
        audioElementsRef.current = container as unknown as HTMLDivElement;
      }
    }

    // Store the connection
    const peerConnection: PeerConnection = { connection: pc, audio };
    peerConnectionsRef.current[peerId] = peerConnection;

    // Log connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`Connection state for ${peerId}:`, pc.connectionState);

      // If connected, try playing audio again
      if (pc.connectionState === "connected") {
        if (audio.paused && audio.srcObject) {
          audio.play().catch((err) => {
            console.error("Error playing audio after connection:", err);
          });
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state for ${peerId}:`, pc.iceConnectionState);

      // If connected, try playing audio again
      if (
        pc.iceConnectionState === "connected" ||
        pc.iceConnectionState === "completed"
      ) {
        if (audio.paused && audio.srcObject) {
          audio.play().catch((err) => {
            console.error("Error playing audio after ICE connection:", err);
          });
        }
      }
    };

    // Add local tracks if we have them
    if (localStreamRef.current) {
      console.log("Adding local tracks to peer connection");
      localStreamRef.current.getAudioTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle incoming tracks
    pc.ontrack = (event) => {
      console.log("Received remote track from:", peerId);
      const [stream] = event.streams;

      if (!stream) {
        console.error("No stream received in ontrack event");
        return;
      }

      // Ensure we're using the latest stream
      audio.srcObject = stream;

      // Force unmute the audio element based on current state
      audio.muted = !isAudioEnabled;

      // Try to play the audio
      playAudioElement(audio, peerId);
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("Sending ICE candidate to:", peerId);
        sendSignal(peerId, event.candidate);
      }
    };

    return peerConnection;
  };

  // Helper function to play an audio element with error handling
  const playAudioElement = (audio: HTMLAudioElement, peerId: string) => {
    if (!audio.srcObject) return;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log(`Successfully playing audio from ${peerId}`);
        })
        .catch((err) => {
          console.error("Error playing audio:", err);

          // Try to play on user interaction
          const playAudio = () => {
            if (!audio.srcObject) return;

            audio
              .play()
              .then(() => {
                console.log(
                  `Successfully playing audio from ${peerId} after user interaction`
                );
                document.removeEventListener("click", playAudio);
              })
              .catch((e) => {
                console.error("Still can't play audio:", e);
              });
          };

          document.addEventListener("click", playAudio, { once: true });

          toast({
            title: "Audio Playback Blocked",
            description: "Click anywhere to enable audio from other users.",
            duration: 5000,
          });
        });
    }
  };

  // Close a peer connection
  const closePeerConnection = (peerId: string) => {
    if (peerConnectionsRef.current[peerId]) {
      console.log("Closing peer connection for:", peerId);

      // Close the connection
      peerConnectionsRef.current[peerId].connection.close();

      // Stop and remove the audio element
      const audio = peerConnectionsRef.current[peerId].audio;
      audio.pause();
      audio.srcObject = null;

      // Remove the audio container from the DOM
      const container = document.getElementById(`audio-container-${peerId}`);
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }

      // Remove from our connections
      delete peerConnectionsRef.current[peerId];

      // Remove from talking users
      setTalkingUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(peerId);
        return newSet;
      });
    }
  };

  // Create and send an offer
  const createAndSendOffer = async (peerId: string, pc: RTCPeerConnection) => {
    try {
      console.log("Creating offer for:", peerId);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });

      console.log("Setting local description");
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete or timeout after 2 seconds
      await new Promise<void>((resolve) => {
        const checkState = () => {
          if (pc.iceGatheringState === "complete") {
            resolve();
          }
        };

        pc.onicegatheringstatechange = checkState;
        checkState();

        // Timeout after 2 seconds
        setTimeout(resolve, 2000);
      });

      // Send the offer with all gathered ICE candidates
      console.log("Sending offer to:", peerId);
      sendSignal(peerId, pc.localDescription || offer);
    } catch (error) {
      console.error("Error creating offer:", error);
    }
  };

  // Handle an incoming offer
  const handleOffer = async (
    peerId: string,
    offer: RTCSessionDescriptionInit
  ) => {
    try {
      console.log("Received offer from:", peerId);

      // Check if we already have a peer connection for this peer
      let peerData = peerConnectionsRef.current[peerId];
      let pc: RTCPeerConnection;

      if (!peerData) {
        // If not, create a new one and get the RTCPeerConnection from it
        console.log("Creating new peer connection for offer");
        peerData = createPeerConnection(peerId);
        pc = peerData.connection;
      } else {
        // If we do, use the existing RTCPeerConnection
        console.log("Using existing peer connection for offer");
        pc = peerData.connection;
      }

      // If we have an existing remote description, we need to rollback
      if (pc.signalingState !== "stable") {
        console.log("Signaling state not stable, rolling back");
        await pc.setLocalDescription({ type: "rollback" });
      }

      // Set the remote description (the offer)
      console.log("Setting remote description (offer)");
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Create an answer
      console.log("Creating answer");
      const answer = await pc.createAnswer();

      // Set the local description (our answer)
      console.log("Setting local description (answer)");
      await pc.setLocalDescription(answer);

      // Wait for ICE gathering to complete or timeout after 2 seconds
      await new Promise<void>((resolve) => {
        const checkState = () => {
          if (pc.iceGatheringState === "complete") {
            resolve();
          }
        };

        pc.onicegatheringstatechange = checkState;
        checkState();

        // Timeout after 2 seconds
        setTimeout(resolve, 2000);
      });

      // Send the answer with all gathered ICE candidates
      console.log("Sending answer to:", peerId);
      sendSignal(peerId, pc.localDescription || answer);
    } catch (error) {
      console.error("Error handling offer:", error);
    }
  };

  // Handle an incoming answer
  const handleAnswer = async (
    peerId: string,
    answer: RTCSessionDescriptionInit
  ) => {
    try {
      console.log("Received answer from:", peerId);
      const pc = peerConnectionsRef.current[peerId]?.connection;

      if (pc) {
        if (pc.signalingState === "have-local-offer") {
          console.log("Setting remote description (answer)");
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } else {
          console.warn(
            "Received answer but signaling state is:",
            pc.signalingState
          );
        }
      } else {
        console.warn("Received answer for non-existent peer:", peerId);
      }
    } catch (error) {
      console.error("Error handling answer:", error);
    }
  };

  // Handle an incoming ICE candidate
  const handleIceCandidate = async (
    peerId: string,
    candidate: RTCIceCandidateInit
  ) => {
    try {
      console.log("Received ICE candidate from:", peerId);
      const pc = peerConnectionsRef.current[peerId]?.connection;

      if (pc) {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          console.warn("Received ICE candidate before remote description");
        }
      } else {
        console.warn("Received ICE candidate for non-existent peer:", peerId);
      }
    } catch (error) {
      console.error("Error handling ICE candidate:", error);
    }
  };

  // Send a signal to a specific peer
  const sendSignal = async (targetClientId: string, signal: any) => {
    if (!channelRef.current) {
      console.error("Cannot send signal: channel not initialized");
      return;
    }

    try {
      // Use client events for peer-to-peer communication
      channelRef.current.trigger("client-signal", {
        sourceClientId: clientId,
        targetClientId,
        signal,
      });
    } catch (error) {
      console.error("Error sending signal:", error);
    }
  };

  // Toggle mute state
  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  // Toggle audio enabled state
  const toggleAudio = () => {
    const newState = !isAudioEnabled;
    setIsAudioEnabled(newState);

    // Log the state change
    console.log(
      `Audio ${newState ? "enabled" : "disabled"}, updating ${Object.keys(peerConnectionsRef.current).length} audio elements`
    );
  };

  // Force play all audio elements (for browsers that block autoplay)
  const forcePlayAudio = () => {
    console.log(
      `Attempting to force play ${Object.keys(peerConnectionsRef.current).length} audio elements`
    );

    Object.entries(peerConnectionsRef.current).forEach(
      ([peerId, { audio }]) => {
        if (audio.srcObject) {
          // Ensure the muted state is correct
          audio.muted = !isAudioEnabled;

          if (audio.paused) {
            console.log(`Forcing play for peer ${peerId}`);
            playAudioElement(audio, peerId);
          } else {
            console.log(`Audio for peer ${peerId} is already playing`);
          }
        } else {
          console.log(`No srcObject for peer ${peerId}`);
        }
      }
    );
  };

  return (
    <div className="flex items-center space-x-2">
      {connectionStatus === "error" && (
        <Button
          variant="outline"
          size="sm"
          className="text-xs text-red-500 border-red-500 mr-2"
          onClick={() => window.location.reload()}
        >
          Reconnect
        </Button>
      )}
      {/* Hidden container for audio elements */}
      <div ref={audioElementsRef} className="hidden" />

      {/* Active users */}
      <div className="flex -space-x-2 mr-2">
        {activeUsers.length > 0
          ? activeUsers.slice(0, 3).map((userId) => (
              <Avatar
                key={userId}
                className={`w-6 h-6 border border-zinc-800 ${talkingUsers.has(userId) ? "ring-2 ring-green-500" : ""}`}
              >
                <AvatarFallback className="bg-zinc-700 text-xs">
                  {userId.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))
          : null}

        {activeUsers.length > 3 && (
          <Badge variant="outline" className="ml-1 bg-zinc-800 text-xs">
            +{activeUsers.length - 3}
          </Badge>
        )}
      </div>

      {/* Mute/unmute button */}
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 rounded-full ${!isMuted ? "bg-green-500/20 text-green-500" : "text-zinc-400"}`}
              onClick={toggleMute}
            >
              {isMuted ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {isMuted ? "Unmute microphone" : "Mute microphone"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Audio enable/disable button */}
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 rounded-full ${isAudioEnabled ? "text-zinc-400" : "bg-red-500/20 text-red-500"}`}
              onClick={toggleAudio}
            >
              {isAudioEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {isAudioEnabled ? "Disable audio" : "Enable audio"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

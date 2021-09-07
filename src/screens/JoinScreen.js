import React, { useState, useEffect, useRef } from "react";
import {
  Text,
  StyleSheet,
  Button,
  View,
  ActivityIndicator,
} from "react-native";

import {
  RTCPeerConnection,
  RTCView,
  mediaDevices,
  RTCIceCandidate,
  RTCSessionDescription,
} from "react-native-webrtc";

import { db } from "../utilities/firebase";

const configuration = {
  iceServers: [
    {
      urls: [
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:stun3.l.google.com:19302",
      ],
    },
  ],
  iceCandidatePoolSize: 10,
};

export default function JoinScreen({ setScreen, screens, roomId }) {
  function onBackPress() {
    if (cachedLocalPC) {
      cachedLocalPC.removeStream(localStream);
      cachedLocalPC.close();
    }
    setLocalStream();
    setRemoteStream();
    setCachedLocalPC();
    // cleanup
    setScreen(screens.ROOM);
  }

  const [localStream, setLocalStream] = useState();
  const [remoteStream, setRemoteStream] = useState();
  const [cachedLocalPC, setCachedLocalPC] = useState();

  const [isMuted, setIsMuted] = useState(false);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // startLocalStream();
    joinCall(roomId);
  }, []);

  const joinCall = async (id) => {
    setLoading(true);
    const roomRef = await db.collection("rooms").doc(id);
    const roomSnapshot = await roomRef.get();

    if (!roomSnapshot.exists) return;
    const localPC = new RTCPeerConnection(configuration);
    // localPC.addStream(localStream);

    const calleeCandidatesCollection = roomRef.collection("calleeCandidates");
    localPC.onicecandidate = (e) => {
      if (!e.candidate) {
        console.log("Got final candidate!", e.candidate);
        return;
      }
      calleeCandidatesCollection.add(e.candidate.toJSON());
    };

    localPC.onaddstream = (e) => {
      if (e.stream && remoteStream !== e.stream) {
        console.log("RemotePC received the stream join", e.stream);
        setLoading(false);

        setRemoteStream(e.stream);
      }
    };

    const offer = roomSnapshot.data().offer;
    await localPC.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await localPC.createAnswer();
    await localPC.setLocalDescription(answer);

    const roomWithAnswer = { answer };
    await roomRef.update(roomWithAnswer);

    roomRef.collection("callerCandidates").onSnapshot((snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === "added") {
          let data = change.doc.data();
          await localPC.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });

    setCachedLocalPC(localPC);
  };

  return (
    <>
      <Button title="Exit Stream" onPress={onBackPress} />

      <Text style={styles.heading}>Join Screen</Text>
      <Text style={styles.heading2}>Room : {roomId}</Text>

      <View style={styles.callButtons}>
        <View styles={styles.buttonContainer}>
          {remoteStream && !loading ? null : ( // <Button title="End Stream" onPress={onBackPress} />
            <View style={{ flexDirection: "row" }}>
              <Text>Loading Stream...</Text>
              <ActivityIndicator />
            </View>
            // <Button title="Join stream" onPress={() => joinCall(roomId)} />
          )}
        </View>
      </View>

      <View style={{ display: "flex", flex: 1 }}>
        <View style={styles.rtcview}>
          {remoteStream && (
            <RTCView
              style={styles.rtc}
              streamURL={remoteStream && remoteStream.toURL()}
            />
          )}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  heading: {
    alignSelf: "center",
    fontSize: 22,
    marginTop: 10,
  },
  heading2: {
    alignSelf: "center",
    fontSize: 18,
  },
  rtcview: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "black",
    margin: 5,
  },
  rtc: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  toggleButtons: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-around",
  },
  callButtons: {
    padding: 10,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-around",
  },
  buttonContainer: {
    margin: 5,
  },
});

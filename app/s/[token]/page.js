import ParticipantSurvey from "./survey";

export default async function SurveyPage({ params }) {
  const { token } = await params;
  return <ParticipantSurvey token={token} />;
}

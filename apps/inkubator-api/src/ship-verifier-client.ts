export interface ShipVerifierClientRequest {submissionId:string; url:string}
export interface ShipVerifierClient {verify(input:ShipVerifierClientRequest):Promise<unknown>}
export function createShipVerifierClient(endpointRaw:string):ShipVerifierClient{
  const endpoint=new URL(endpointRaw);
  if(endpoint.protocol!=='http:'||endpoint.hostname!=='127.0.0.1'||!endpoint.port||endpoint.username||endpoint.password)throw new Error('INKUBATOR_VERIFIER_URL must be loopback http://127.0.0.1:<port>');
  endpoint.pathname='/v1/verify-url';endpoint.search='';endpoint.hash='';
  return{async verify(input){
    const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({schema_version:'ship-verifier.request.v1',submission_id:input.submissionId,url:input.url}),signal:AbortSignal.timeout(10_000)});
    if(!response.ok)throw new Error(`ship_verifier_service_status:${response.status}`);
    return await response.json();
  }};
}

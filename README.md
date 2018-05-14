## Application Tracing on Fargate with AWS X-Ray

This is a continuation of an earlier [post](https://aws.amazon.com/de/blogs/compute/application-tracing-on-kubernetes-with-aws-x-ray/) on application tracking on Kubernetes with AWS X-Ray.

As microservices proliferate, the ability to trace calls between different different services becomes increasingly important. This can be accomplished using AWS X-Ray, a managed service that provides distributed application tracing functionality. X-Ray was built to help you understand how your services are interacting with each other by surfacing information such as call latency and exceptions, which together, helps you analyze, debug, and resolve issues faster.

Containers have become a popular vehicle for packaging and deploying microservices because they’re lightweight, polyglot, and run consistently as they’re moved across different environments. It’s not unusual for these types of applications to be deployed using a container orchestration platform like ECS. ECS simplifies running containers by providing a managed control plane for managing cluster resources and scheduling your containers onto a fleet of EC2 instances. These instances, however, are still your responsibility. Since managing a large fleet of hosts can be complex, we built Fargate, a managed service that removes “undifferentiated heavy lifting” that often accompanies management of a fleet of container instances. Fargate allows you to concentrate on building and operating your application, rather than infrastructure and gives you yet another option for running your microservices applications.

## Running X-Ray on Fargate

The remainder of this post explains how to run X-Ray as a sidecar container in a Fargate task. By doing this, you will be able to provide application tracing capabilities to services running on Fargate.

The code, including a simple Node.js based demo application is available in the corresponding aws-xray-fargate (https://github.com/jicowan/aws-xray-kubernetes/tree/master/fargate) GitHub repository, so you can quickly get started with X-Ray.

The sample application within the repository consists of two simple microservices, Service-A and Service-B. The following diagram illustrates how each service is deployed with 2 Fargate services:


* Requests are sent to the Service-A from clients.
* Service-A then contacts Service-B.
* The requests are serviced by Service-B.
* Service-B adds a random delay to each request to show different response times in X-Ray.


To test out the sample applications on your own ECS/Fargate cluster use the Dockerfiles provided in the GitHub repository, then follow the steps in the README file.

## Prerequisites

If you do not have an ECS cluster running within your AWS environment, create it now using the following command:

`aws ecs create-cluster --cluster-name <cluster_name> --region us-east-1`

*NOTE:* At present, you can only create Fargate tasks in us-east-1, us-east-2, us-west-2 and eu-west-1.

## Deploy X-Ray as a sidecar container

In Christoph Kassen’s blog post, he describes how to deploy the X-Ray pod as a Kubernetes daemonset. A daemonset is a special type of deployment strategy that places one instance of a pod onto each instance in the cluster. It will also deploy an instance of that pod onto Kubernetes workers as they’re added to the cluster. Since Fargate doesn’t yet have support for daemonsets, you have to deploy X-Ray as a sidecar container. A sidecar container is a container that runs alongside another container in the same Fargate task.

[INSERT IMAGE SHOWING X-RAY AS A SIDECAR]

The task definitions in the GitHub repository are already configured to run X-Ray as a sidecar container.

## Connecting to the X-Ray daemon

To integrate application tracing with your applications, use the X-Ray SDK for one of the supported programming languages:


* Java
* Node.js
* .NET (Framework and Core)
* Go
* Python


The SDKs provide classes and methods for generating and sending trace data to the X-Ray daemon. Trace data includes information about incoming HTTP requests served by the application, and calls that the application makes to downstream services using the AWS SDK or HTTP clients.

By default, the X-Ray SDK expects the daemon to be available on 127.0.0.1:2000. Since we’re running X-Ray as a sidecar container, no changes are necessary.

## Sending tracing information to AWS X-Ray

Sending tracing information from your application is straightforward with the X-Ray SDKs. The example code below serves as a starting point to instrument your application with traces. Take a look at the two sample applications in the GitHub repository to see how to send traces from Service A to Service B. The diagram below visualizes the flow of requests between the services.

Since Fargate is a service that manages the instances your tasks run on, access to the underlying host is prohibited. Consequently, the ECSPlugin and EC2Plugins for X-Ray will not work.

```
var app = express();

//...

var AWSXRay = require('aws-xray-sdk');

app.use(AWSXRay.express.openSegment('defaultName')); //required at the start of your routes

app.get('/', function (req, res) {
res.render('index');
});

app.use(AWSXRay.express.closeSegment()); //required at the end of your routes / first in error handling routes
```

For more information about all options and possibilities to instrument your application code, see the X-Ray documentation (https://aws.amazon.com/documentation/xray/) page for the corresponding SDK information.

The image below shows the resulting service map that provides insights into the flow of requests through the microservice landscape. You can drill down here into individual traces and see which path each request has taken.


From the service map, you can drill down into individual requests and see where they originated from and how much time was spent in each service processing the request.


You can also view details about every individual segment of the trace by clicking on it. This displays gives more details.


## Summary

In this post I shared how to deploy and run X-Ray running as a sidecar container in a Fargate task. By using X-Ray for distributed tracing you can get insights into how well your applications are performing and spot issues early before them become real problems.


## License

This library is licensed under the Apache 2.0 License.

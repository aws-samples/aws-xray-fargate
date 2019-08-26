Create a task role that allows the task to write traces to AWS X-Ray.  Replace *<role_name>* with your role name. 

```
export TASK_ROLE_NAME=$(aws iam create-role --role-name <role_name> --assume-role-policy-document file://ecs-trust-pol.json | jq -r '.Role.RoleName')
export XRAY_POLICY_ARN=$(aws iam create-policy --policy-name <policy_name> --policy-document file://xray-pol.json | jq -r '.Policy.Arn')
aws iam attach-role-policy --role-name $TASK_ROLE_NAME --policy-arn $XRAY_POLICY_ARN
```

If this is your first time using ECS you will need to create the ECS Task Execution Role.

```
aws iam create-role --role-name ecsTaskExecutionRole --assume-role-policy-document file://ecs-trust-pol.json
export ECS_EXECUTION_POLICY_ARN=$(aws iam list-policies --scope AWS --query 'Policies[?PolicyName==`AmazonECSTaskExecutionRolePolicy`].Arn' | jq -r '.[]')
aws iam attach-role-policy --role-name ecsTaskExecutionRole --policy-arn $ECS_EXECUTION_POLICY_ARN
```

Export the Arns of the task role and the task execution role. 

```
export TASK_ROLE_ARN=$(aws iam get-role --role-name <role_name> --query "Role.Arn" --output text)
export TASK_EXECUTION_ROLE_ARN=$(aws iam get-role --role-name ecsTaskExecutionRole --query "Role.Arn" --output text)
```

Get a list of subnets in a VPC.  Replace *<vpc_id>* with the vpc id of the vpc where you intend to deploy the services.

```
aws ec2 describe-subnets --query 'Subnets[?VpcId==`<vpc_id>`].SubnetId'
```

Choose at least 2 subnets to set as environment variables.  These will be used to populate the ecs-params.yml file.

```
export SUBNET_ID_1=<subnet_id_1>
export SUBNET_ID_2=<subnet_id_2>
```

Create a security group. Replace *<group_name>*, *<description_text>*, and *<vpc_id>* with the appropriate values. The *<vpc_id>* should match the vpc id you used earlier. 

```
export SG_ID=$(aws ec2 create-security-group --group-name <group_name> --description <description_text> --vpc-id <vpc_id> | jq -r '.GroupId')
```

Add the following inbound rules to the security group.

```
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol all --port all --source-group $SG_ID
```

Create an Application Load Balancer (ALB), listener, and target group for service B.

```
export LOAD_BALANCER_ARN=$(aws elbv2 create-load-balancer --name <load_balancer_name> --subnets $SUBNET_ID_1 $SUBNET_ID_2 --security-groups $SG_ID --scheme internet-facing --type application | jq -r '.LoadBalancers[].LoadBalancerArn')
export TARGET_GROUP_ARN=$(aws elbv2 create-target-group --name <target_group_name> --protocol HTTP --port 8080 --vpc-id <vpc_id> --target-type ip --health-check-path /health | jq -r '.TargetGroups[].TargetGroupArn')
aws elbv2 create-listener --load-balancer-arn $LOAD_BALANCER_ARN --protocol HTTP --port 80 --default-actions Type=forward,TargetGroupArn=$TARGET_GROUP_ARN
```

Get the DNS name of the load balancer. 

```
export SERVICE_B_ENDPOINT=$(aws elbv2 describe-load-balancers --load-balancer-arn $LOAD_BALANCER_ARN | jq -r '.LoadBalancers[].DNSName')
```

Build and push the containers to ECR.

```
cd ./service-b/
docker build -t service-b .
ecs-cli push service-b
cd ./service-a/
docker build -t service-a .
ecs-cli push service-a
```

Set the registry URLs

```
export REGISTRY_URL_SERVICE_B=$(aws ecr describe-repositories --repository-name service-b | jq -r '.repositories[].repositoryUri')
export REGISTRY_URL_SERVICE_A=$(aws ecr describe-repositories --repository-name service-a | jq -r '.repositories[].repositoryUri')
```

Create logs groups.

```
aws logs create-log-group --log-group-name /ecs/service-b
aws logs create-log-group --log-group-name /ecs/service-a
```

Create service B.

```
cd ./service-b/
envsubst < docker-compose.yml-template > docker-compose.yml
envsubst < ecs-params.yml-template > ecs-params.yml
ecs-cli compose service up --deployment-max-percent 100 --deployment-min-healthy-percent 0 --target-group-arn $TARGET_GROUP_ARN --launch-type FARGATE --container-name service-b --container-port 8080 --cluster <clustername>
```

Create an Application Load Balancer (ALB), listener, and target group for service A.

```
export LOAD_BALANCER_ARN=$(aws elbv2 create-load-balancer --name <load_balancer_name> --subnets $SUBNET_ID_1 $SUBNET_ID_2 --security-groups $SG_ID --scheme internet-facing --type application | jq -r '.LoadBalancers[].LoadBalancerArn')
export TARGET_GROUP_ARN=$(aws elbv2 create-target-group --name <target_group_name> --protocol HTTP --port 8080 --vpc-id <vpc_id> --target-type ip --health-check-path /health | jq -r '.TargetGroups[].TargetGroupArn')
aws elbv2 create-listener --load-balancer-arn $LOAD_BALANCER_ARN --protocol HTTP --port 80 --default-actions Type=forward,TargetGroupArn=$TARGET_GROUP_ARN
```

Create service A. 

```
cd ./service-a/
envsubst < docker-compose.yml-template > docker-compose.yml
envsubst < ecs-params.yml-template > ecs-params.yml
ecs-cli compose service up --deployment-max-percent 100 --deployment-min-healthy-percent 0 --target-group-arn $TARGET_GROUP_ARN --launch-type FARGATE --container-name service-a --container-port 8080 --cluster <clustername>
```

Open the X-Ray console.
